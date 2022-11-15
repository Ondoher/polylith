import path from 'node:path/posix';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {fixPath} from './utils.js';
var templateSource;

function makeSource(loadables) {
	var loadableSwitches = '';

	function makeCss(loadable) {
		if (!loadable.css) return '';
		var jsonCss = JSON.stringify(loadable.css);
		return (
`						App.loadCss(${jsonCss});`
		)

	}

	function makeServices(loadable) {
		if (!loadable.prefix) return '';
		return (
`						await registry.start('${loadable.prefix}');`
		)
	}

	loadables.forEach(function(loadable) {
		var prefixStr = ';';
		var cssStr = makeCss(loadable);
		var serviceStr = makeServices(loadable);

		if (loadable.prefix || loadable.css) {
			prefixStr = `
					.then(async function(result) {
${cssStr}
${serviceStr}
					});
`
		}

		var switchStr =
`			case '${loadable.name}':
				promise = import('${loadable.path}')${prefixStr}
				break;
`
		loadableSwitches += switchStr;
	})

	var source = templateSource;
	var source = source.replace('{{SWITCHES}}', loadableSwitches);
	var source = source.replace(/\t/g, '    ');

	console.log(source);

	return source;
}


export default function loader(loadables) {
	return {
		name: 'loader',

		resolveId (source, _, third) {
			if (source === '@polylith/loader') {
				return source;
			}
			return null;
		},

		async load (id) {
			var root = path.dirname(fixPath(import.meta.url));
			if (!templateSource) {
				templateSource = await readFile(path.join(root, 'loaderTemplate.txt'), 'utf-8');
				console.log(templateSource);
			}

			if (id === '@polylith/loader') {
				return makeSource(loadables);
			}
			return null;
		}
	};
}
