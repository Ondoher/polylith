function makeSource(configs) {

	var configBody = ''

	configs.forEach(function(config) {
		configBody +=
`config.add(
${JSON.stringify(config, null, '    ')})

`
	})

	var source =
`import config from '@polylith/config-store';
export default config;

${configBody}
`
	return source;
}

export default function loadConfigs(configs) {
	return {
		name: 'config',

		resolveId (source, _, third) {
			if (source === '@polylith/config') {
				return source;
			}
			return null;
		},

		async load (id) {
			if (id === '@polylith/config') {
				return makeSource(configs);
			}
			return null;
		}
	};
}
