import deepmerge from 'deepmerge';

var configStore = {};

function add(config) {
	if (typeof config !== 'object' || Array.isArray(config)) {
		console.warn('Only object can be added to a config');
	}
	configStore = deepmerge(configStore, config)
}

function get(key) {
	var parts = key.split('.');
	var result = configStore;
	while (parts.length > 0) {
		let key = parts.shift();
		result = result[key];

		if (!result) return false;
	}

	return result;
}

export default {
	add: add,
	get: get,
}
