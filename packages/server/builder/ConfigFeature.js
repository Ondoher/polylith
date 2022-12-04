import Feature from './Feature.js';
import path from 'node:path/posix';
import App from './App.js';

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
	 *
	 * @param {App} app the application for the feature
	 */
	async build(app, forTest) {
		var config = this.config;

		if (!forTest) {
			if (config.loadables && Array.isArray(config.loadables)) {
				for (let loadable of config.loadables) {
					if (loadable.name && loadable.index) {
						await app.addLoadable(this.root, loadable.name, path.join(this.root, loadable.index), loadable.prefix, loadable.css);
					}
				}
			}
		}

		if (config.index) app.addFeatureIndex(path.join(this.root, config.index));
		if (config.config) app.addConfig(config.config, this.root);
		if (config.resources && Array.isArray(config.resources)) app.addResources(this.root, config.resources);
		if (config.css && Array.isArray(config.css)) app.addMainCss(this.root, config.css);
	}
}
