import App from './App';
import path from 'node:path/posix';

export default class ConfigApp extends App {
	constructor (config, root) {
		App.fixPath(root);
		var name = config.name || 'unnamed';
		var index = config.index || path.join(root, 'src', 'index.js');
		var dest = config.dest || path.join(root, 'dist');

		super(name, root, index, dest);
		this.config = config;

		if (!index.template || !index.template.source) throw new Error('html source not defined in config file');
		var source = index.template.source;
		var sourceFilename = path.basename(source);
		var destination = index.template.destination || path.join(dest, sourceFilename)
		this.setHtmlTemplate(source, destination);

		if (config.manualChunks) this.addManualChunks(config.manualChunks);
		if (this.config.features) {
			this.config.features.forEach(function(feature) {
				this.addFeature(feature);
			}.bind(this))
		}

		if (config.resources) ;
	}

	async getFeatures() {
		return this.config.features || [];
	}
}
