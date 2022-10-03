function makeSource(features) {

	var importStatements = '';
	features.forEach(function(feature) {
		importStatements += `import '${feature}'\n`;
	})

	var source = `${importStatements}`

	return source;
}


export default function features(features) {
	return {
		name: 'features',

		resolveId (source, _, third) {
			if (source === '@polylith/features') {
				return source;
			}
			return null;
		},

		load (id) {
			if (id === '@polylith/features') {
				return makeSource(features);
			}
			return null;
		}
	};
}
