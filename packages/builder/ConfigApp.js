import App from './App.js';
import path from 'node:path/posix';
import {forceToPosix} from './utils.js'

/**
 * This class is used to build an application from a configuration file.
 */
export default class ConfigApp extends App {
	/**
	 *
	 * @param {*} config
	 * @param {*} options
	 * @param {*} root
	 */
	constructor (options, config, root) {
		root = forceToPosix(root);
		var name = config.name || 'unnamed';
		var index = config.index || 'src/index.js';
		var dest = config.dest || 'dist';
		var spec = config.spec;
		var testDest = config.testDest;

		super(name, options, {root, index, dest, spec, testDest});

		if (!config.template || !config.template.source) throw new Error('html source not defined in config file');
		var source = config.template.source;
		var sourceFilename = path.basename(source);
		var destination = config.template.destination || path.join(dest, sourceFilename);
		this.setHtmlTemplate(source, destination);

		if (config.manualChunks) {
			config.manualChunks.forEach(function(chunk) {
				this.addManualChunks(chunk);
			}, this)
		}

		if (config.features) {
			config.features.forEach(function(feature) {
				this.addFeature(feature);
			}.bind(this))
		}

		if (config.resources && Array.isArray(config.resources)) this.addResources('', config.resources);
		if (config.css) this.addMainCss('', config.css);

		if (config.variables) {
			var names = Object.keys(config.variables);

			names.forEach(function(name) {
				this.addCodeVariable(name, config.variables[name]);
			}, this)
		}

		if (config.routerRoot) {
			this.setRouterRoot(config.routerRoot);
		}

		if (config.router) {
			this.setRouterModule(config.router);
		}

		if (config.liveReload) {
			this.setLiveReloadOptions(config.liveReload);
		}
	}
}
