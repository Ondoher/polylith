import path from 'node:path';
import {readFile, writeFile, stat} from 'node:fs/promises';

import * as rollup from 'rollup';
import { babel } from '@rollup/plugin-babel';
import * as resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import html from 'rollup-plugin-html';

import loader from './plugin-loader.js';
import mainHTML from './plugin-main-html.js';
import features from './plugin-features.js';
import styles from "rollup-plugin-styles";
import resources from "./plugin-copy-resources.js";
import jsconfig from "./plugin-jsconfig.js";

import ConfigFeature from './ConfigFeature.js';
import Files from './Files.js';

/**
 * call this function to check if the given file exists
 *
 * @param {String} path the name of the file
 * @returns {Promise<Boolean>} true if the file exists
 */

async function fileExists(path) {
    try {
        await stat(path)
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * The base class for applications. Applications inherit from this class
 */
export default class App {
	/**
	 * Construct the app object.
	 *
	 * @param {String} name a name for the app
	 * @param {String} root the root directory of the project. All other
	 *  	paths will be relative to this path.
	 * @param {String} index the relative path to the main source file from the
	 * 		root. All source paths will be assumed to be relative to this path.
	 * @param {String} dest the relative path to the destination folder from the
	 * 		root for rolled up files
	 */

	constructor(name, root, index, dest) {
		root = App.fixPath(root);
		this.root = root;

		var filename = path.posix.join(root, index);
		this.sourcePath = path.posix.dirname(filename);
		this.destPath = path.posix.join(root, dest);

		this.name = name;
		this.index = index;
		this.fullIndexPath = path.posix.join(root, index);

		this.loadables = [];
		this.features = [];
		this.featureIndexes = [];
		this.configs = {};
		this.manualChunkType = 'function';
		this.manualChunks = [];
		this.files = new Files(this.sourcePath, this.destPath);
		this.cssFiles = [];
	}

	static fileToPath(filename) {
		filename = App.fixPath(filename);
		return path.posix.dirname(filename);
	}

	/**
	 * call this method to force the file path to use posix notation and remove
	 * all drive information.
	 *
	 *
	 * @param {String} src the filename wqe
	 * @returns {String} the new path
	 */
	static fixPath(src) {
		src = src.replace('file:', '');
		src = src.replace('///', '');
		src = src.replace(/.:/, '');
		src = src.replace(/\\/g, '/');

		return src;
	}

	/**
	 * Call this method to generate a path relative to the src directory
	 *
	 * @param {String} fully qualified path
	 * @returns the path relative to the source root.
	 */
	rootPath(path) {
		var idx = path.indexOf(this.sourcePath);
		if (idx === 0) path = path.slice(this.sourcePath.length);
		if (path[0] === '/') path = path.slice(1);

		return './' + path;
	}

	setHtmlTemplate(source, destination) {
		this.htmlTemplate = {source: source, destination: destination};
	}

	addConfig(config, root) {
		this.configs[root] = config;
	}

	async addMainCss(specs) {
		var files = new Files(this.sourcePath, this.destPath)

	// get the file paths
		specs.forEach(function(spec) {
			files.addCopySpec('', spec);
		}, this)

		var expanded = await files.findAllFiles();
		var keys = Object.keys(expanded);
		keys.forEach(function(key){
			var file = expanded[key];
			this.cssFiles.push(file.uri)
		}, this);

	// now add them to be copied
		this.addResources('', specs);
	}

	/**
	 * Call this method to add a list of resources that will be moved to the
	 * destination path when the application is built. This will either be a
	 * feature root, or the source path
	 *
	 * @param {Array<import('./Files.js').CopySpec} resourceSpecs the copy specs
	 * 		for all the resources being added.
	 * @param {String} root the path to the origin of the caller. Paths in
	 * 		the spec are assumed to be relative to this.
	 */
	addResources(root, resourceSpecs) {
		resourceSpecs.forEach(function(spec) {
			this.files.addCopySpec(root, spec);
		}, this)
	}

	/**
	 * Call this method to add a feature to the application. This method is
	 * given a path to the root of the feature. At build time the builder will
	 * look directory for a file named build.js and if found import it and
	 * call the default function passing it a pointner to this object.
	 *
	 * If there is no build.js file the builder will look for a build.json file.
	 * If present that json will be loaded and used to build the feature.
	 *
	 * If that is not found it will look for an index.js file. and if found it
	 * will add that to the list of feature index files which will be
	 * automatically imported when the built code imports the @polylith/features
	 * module
	 *
	 * @param {String} feature the relative path from the application source
	 * 		directory to the feature root.
	 */
	addFeature(feature) {
		this.features.push(feature);
	}

	/**
	 * Call this method to add a feature index file to the application. These
	 * features will be imported when the application imports
	 * "@polylith/features"
	 *
	 * @param {String} index the relative path to the feature index file from
	 * 		the application source folder.
	 */
	addFeatureIndex(index) {
		this.featureIndexes.push(path.join(this.sourcePath, index));
	}

	/**
	 * Call this method to add a new manual chunk specifier. The type of the
	 * parameter passed will determine how the specifier will be processed. If
	 * the type differs from previously added types, then the previous
	 * specifiers will be removed.
	 *
	 * @param {Object|Function|Array} spec the chunk name specifier to be added.
	 */
	addManualChunk(spec) {
		var type = typeof spec === 'function' ? 'function' : 'object';
		type = Array.isArray(spec) ? 'array' : type;

		if (this.manualChunkType != type) {
			console.warn(`addManualChunk of type ${type} will override previously set of type ${this.manualChunkType}`);
			if (type === 'object') this.manualChunks = {}
			else this.manualChunks === [];
			this.manualChunkType = type;
		}

		if (type === 'function') {
			this.manualChunks.unshift(spec);
		} else if (type === 'array') {
			var keys = Object.keys(spec);
			spec.forEach(function(one) {
				this.manualChunks.unshift(one);
			}.bind(this));
		} else if (type === 'object') {
			var keys = Object.keys(spec);
			keys.forEach(function(key) {
				this.manualChunks[key] = spec[key];
			}.bind(this));
		}
	}

	/**
	 * If no manual chunk specifiers are added, then this will be used as the
	 * default.
	 *
	 * @param {String} id this is the filename of the current file being
	 * 		processed by rollup
	 *
	 * @returns {String} the chunk name if there is a match
	 */
	defaultManualChunks(id) {
		if (id.includes('node_modules')) {
			return 'vendor';
		}
	}

	/**
	 * This is called when manual chunk specifications have been added as an
	 * array.
	 *
	 * @param {String} id this is the filename of the current file being
	 * 		processed by rollup
	 * @returns {String} the name fo the chunk if there is a matching chunk
	 * 		name specifier
	 */
	handleManualChunksArray(id) {
		var fixId = App.fixPath(id);
		var result = this.manualChunks.find(function(spec) {
			return fixId.includes(spec.includes);
		})

		if (result) return result.name;
	}

	/**
	 * This is called when the manual chunk specifiers are functions. Each
	 * registered function is called in the reverse order to how they were
	 * added.
	 *
	 * @param {String} id this is the filename of the current file being
	 * 		processed by rollup
	 * @returns the chunk name if any of the callbacks return one
	 */
	handleManualChunksCallbacks(id) {
		var fixId = App.fixPath(id);
		if (this.manualChunks.length === 0) {
			return this.defaultManualChunks(fixId);
		} else {
			for (let idx = 0; idx < this.manualChunks.length; idx++) {
				var result = this.manualChunks[idx](fixId);
				if (result) return result;
			}
		}
	}

	/**
	 * This is called by the builder to get the method to handle manual chunks
	 * based on how they have been setup. The value returned from this funtion
	 * will be the value set in the rollup options object.
	 *
	 * @returns {Object|Function} the value to assign to the manualChunk field.
	 */
	getManualChunks() {
		if (this.manualChunkType === 'object') return this.manualChunks;
		if (this.manualChunkType === 'array') return this.handleManualChunksArray.bind(this);
		if (this.manualChunkType === 'function') return this.handleManualChunksCallbacks.bind(this);
	}

	/**
	 * Call this method to add the feature to the app. Features are isolated
	 * pieces of code that are not a direct dependency of the main application.
	 *
	 * @param {String} root path relative to the source directory for the
	 * 		feature to load.
	 */
	async loadFeature(root) {
		var featurePath = path.posix.join(this.sourcePath, root);
		var indexPath = path.posix.join(featurePath, 'index.js')
		var builderPath = path.posix.join(featurePath, 'build.js');
		var jsonPath = path.posix.join(featurePath, 'build.json');

		var indexExists = await fileExists(indexPath);
		var builderExists = await fileExists(builderPath);
		var jsonExists = await fileExists(jsonPath);

		// If there is a builder, we will use this
		if (builderExists) {
			try {
				let module = await import(builderPath)
				let feature = module.default;
				await feature.build(this);
			} catch(e) {
				console.error('error while building feature', root);
				console.log(e);
			}

		// second priority is a build configuration file.
		} else if (jsonExists) {
			try {
				let content = JSON.parse(await readFile(jsonPath));

				let builder = new ConfigFeature(content, root);
				await builder.build(this)
			} catch (e) {
				console.error(e);
				throw e;
			}

		// if neither exist, assume the index should be added
		} else if (indexExists) this.featureIndexes.push(indexPath);
	}

	async buildFeatures() {
		var features = this.features;

		for (let feature of features) {
			await(this.loadFeature(feature));
		}
	}

	/**
	 *
	 * @param {String} name unique name of the loadable that will be passed to
	 * 		the load method
	 * @param {String} main the relative path from the source folder to the entry
	 * 		point of the loadable.
	 * @param {String} [prefix] if given, the prefix on services created in
	 * 		this loadable. When the loadable has been loaded, the start and
	 * 		ready methods will be called on all services starting with this
	 * 		prefix.
	 * @param {Array<CopySpec>} [css] if supplied it will be a copy spec of the
	 * 		css files that will included when the module is loaded
	 */
	async addLoadable(root, name, main, prefix, css) {
		// expand css specs
		var cssUris = css ? [] : undefined;
		if (css) {
			var files = new Files(this.sourcePath, this.destPath)
			css.forEach(function(spec) {
				files.addCopySpec(root, spec);
			}, this)
			var expanded = await files.findAllFiles();
			var keys = Object.keys(expanded);
			keys.forEach(function(key){
				var file = expanded[key];
				cssUris.push(file.uri)
			}, this)
		}

		var dest = path.posix.join(this.sourcePath, main);
		this.loadables.push({name, path: dest, prefix, css: cssUris});
	}


	buildMainCss() {
		var cssTags = '';
		this.cssFiles.forEach(function(uri) {
			cssTags += `		<link rel="stylesheet" href="${uri}"></link>`
		}, this);

		return cssTags;
	}

	/**
	 * The build method calls this method to create the rollup configuration
	 * object
	 *
	 * @returns {Object} rollup configuration object
	 */

	buildConfiguration() {
		var input = [this.fullIndexPath];
		this.loadables.forEach(function(spec) {
			input.push(spec.path);
		});

		this.variables = {
			pattern: 'main-js',
			replacement: `<script type="module" src="${this.index}"></script>`
		}

		var manualChunks = this.getManualChunks();
		var mainCss = this.buildMainCss();

		var config = {
			input : {
				input: input,
				plugins: [
					resolve.nodeResolve({
						extensions: ['.js', '.jsx']
					}),
					commonjs(),
					babel({
						presets: ['@babel/preset-react'],
						babelHelpers: 'bundled',
					}),
					loader(this.loadables),
					features(this.featureIndexes),
					jsconfig(this.root),
					html({
						include: path.join(this.sourcePath, "**/*.html"),
					}),
					styles(),
					mainHTML({
						root: this.root,
						source: this.htmlTemplate.source,
						destination: this.htmlTemplate.destination,
						replaceVars: {mainCss: mainCss},
					}),
					resources(this.name, this.files)
				],
			},
			output : {
				output : {
					sourcemap: true,
					dir : this.destPath,
					format: 'es',
					assetFileNames: function(chunkInfo) {
						return '[name]-[hash][extname]';
					},
					entryFileNames: function(chunkInfo) {
						var entry = App.fixPath(chunkInfo.facadeModuleId);
						var found = this.loadables.find(function(loadable) {
							return loadable.path === entry;
						}, this);
						var exists = Boolean(found);

						if (exists) return (`${found.name}.js`);
						if (entry === this.fullIndexPath) {
							return `${this.name}.js`;
						}
						return '[name].js';
					}.bind(this),
					manualChunks: manualChunks,
				},
			},
			watch : {
				watch: {
					buildDelay: 250,
					exclude: 'node_modules/**',
					clearScreen: true,
				}
			}
		};

		return config;
	}

	async build() {
		await this.buildFeatures();
		this.config = this.buildConfiguration();

		const bundle = await rollup.rollup(this.config.input);
		await bundle.generate(this.config.output);
		await bundle.write(this.config.output);
		await bundle.close();
	}

	watch() {
		var watchConfig  = {
			...this.config.input,
			output: [this.config.output.output],
			...this.config.watch,
		}

		const watcher = rollup.watch(watchConfig);
		watcher.on('event', function(event) {
			console.log(event.code);
			if (event.result) {
				event.result.close();
			}

			if (event.code === 'ERROR') {
				console.error(event.error)
			}

			if (event.code === 'BUNDLE_START') {
				process.stdout.write("\u001b[2J\u001b[0;0H");
				console.log(event);
			}

			if (event.code === 'BUNDLE_END') {
				process.stdout.write("\u001b[2J\u001b[0;0H");
				console.log(event);
			}
		}.bind(this));
	}
}
