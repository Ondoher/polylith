import Feature from './Feature.js';

export default class ConfigFeature extends Feature {
	/**
	 * Constrctor for the ConfigFeature class
	 *
	 * @param {Object} config the contents of the config file
	 * @param {String} root the relative path of the feature from the app source directory
	 */
	constructor (config, root) {
		super(root);
		this.config = config;
	}

	/**
	 * The application calls the method to build the feature.
	 * @param {App} app the application for th
	 */
	async build(app) {
		var config = this.config;

		if (config.loadables && Array.isArray(config.loadables)) {
			config.loadables.forEach(function(loadable) {
				if (loadable.name && loadable.index) {
					app.addLoadable(loadable.name, loadable.index, loadable.prefix);
				}
			}, this);
		}

		if (config.index) app.addFeatureIndex(config.index);
		if (config.config) app.addConfig(config.config, this.root);
		if (config.resources && Array.isArray(config.resources)) app.addResources(config.resources, this.root);
	}
}
