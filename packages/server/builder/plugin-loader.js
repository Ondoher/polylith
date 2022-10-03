function makeSource(loadables) {

	var loadableSwitches = '';

	loadables.forEach(function(loadable) {
		var prefixStr = ';';

		if (loadable.prefix) {
			prefixStr = `
					.then(async function(result) {
						await registry.start('${loadable.prefix}');
						return result;
					});
`
		}

		var switchStr = `
			case '${loadable.name}':
				promise = import('${loadable.path}')${prefixStr}
				break;
`
		loadableSwitches += switchStr;
	})

	var source =
`
	import {registry} from '@polylith/core';

	export async function load(name) {
		var promise;

		switch (name) {
${loadableSwitches}
		}
		return promise;
	}
`
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

		load (id) {
			if (id === '@polylith/loader') {
				return makeSource(loadables);
			}
			return null;
		}
	};
}
