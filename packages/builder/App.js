import path from 'node:path';
import {readFile, writeFile, stat} from 'node:fs/promises';
import cc from "@ondohers/console-colors";
import express from 'express';
import * as rollup from 'rollup';
import { babel } from '@rollup/plugin-babel';
import * as resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import rollupJson from "@rollup/plugin-json"
import svgr from '@svgr/rollup'
import html from 'rollup-plugin-html';
import livereload from 'rollup-plugin-livereload';
import styles from "rollup-plugin-styles";
import nodePolyfills from 'rollup-plugin-polyfill-node';
import loader from './plugin-loader.js';
import mainHTML from './plugin-main-html.js';
import features from './plugin-features.js';
import resources from "./plugin-copy-resources.js";
import jsconfig from "./plugin-jsconfig.js";
import loadConfigs from "./plugin-config.js";
import watchLog from "./plugin-watch.js";
import { terser } from "rollup-plugin-terser";
import {forceToPosix, fileExists} from './utils.js'
import ConfigFeature from './ConfigFeature.js';
import Files from './Files.js';

/**
 * The base class for applications. Applications inherit from this class
 */
export default class App {
	/**
	 * Construct the app object.
	 *
	 * @param {String} name a name for the app
	 * @param {Object} config polylith configuration file
	 * @param {Object} setup
	 * @property {String} root the full path to the root directory of the project.
	 * 		All other paths will be relative to this path.
	 * @proprty {String} index the relative path to the main source file from the
	 * 		root. All source paths will be assumed to be relative to this path.
	 * @property {String} dest the relative path to the destination folder from
	 * 	the root for rolled up files
	 * @property {String} spec the relative path to the testing source file from
	 * 		the root. All source paths will be assumed to be relative to this
	 * 		path.
	 * @property {String} testDest the relative path to the testing destination
	 * 	folder from the root for rolled up files
	 */
	constructor(name, config, setup) {
		var {root, index, dest, spec, testDest=''} = setup;

		this.polylithConfig = config;
		this.setup = setup;
		root = forceToPosix(root);
		this.root = root;
		this.routerRoot = '/' + name;

		var filename = path.posix.join(root, index);
		this.sourcePath = path.posix.dirname(filename);
		this.destPath = path.posix.join(root, dest);
		this.testPath = path.posix.join(root, testDest);

		this.name = name;
		this.index = index;
		this.spec = spec;
		this.fullIndexPath = path.posix.join(root, index);
		this.fullSpecPath = spec ? path.posix.join(root, spec) : undefined;

		this.loadables = [];
		this.features = [];
		this.featureIndexes = [];
		this.configs = [];
		this.manualChunkType = 'function';
		this.manualChunks = [];
		this.files = new Files(this.sourcePath, this.destPath, this.testPath);
		this.cssSpecs = [];
		this.cssFiles = [];
		this.liveReload = true;
		this.templateVariables = {};
		this.ns = name.replace(/[- ]+/g, '_').toUpperCase();
		this.codeVariables = {};
	}

	/**
	 * Call this method to set the code variable name space. An object with this
	 * name will be attached to the window object with the code variables as
	 * members. The default value for the name space is the app name in upper
	 * snake case.
	 *
	 * @param {String} ns the name space name for added code variables. This
	 * 		must be a valid JavaScript identifier.
	 */
	setNamespace(ns) {
		this.ns = ns;
	}

	getRouterRoot() {
		return this.routerRoot;
	}

	setRouterRoot(root) {
		this.routerRoot = root;
	}

	/**
	 * Call this method to set the relative path from the project root, to a
	 * module that exports a default asynchrounsous method that takes an express
	 * router and will add to it the application specific routes.
	 *
	 * @param {String} modulePath
	 */
	setRouterModule(modulePath) {
		this.modulePath = path.posix.join(this.root, modulePath);
	}

	/**
	 * This is called by the polylith server to setup routing for the
	 * application
	 *
	 * @param {express.Router} appRouter
	 * @returns {Promise}
	 */
	async router(express, appRouter) {
		if (!this.modulePath) return;

		try {
			let module = await import(this.modulePath)
			let router = module.default;
			await router(express, appRouter, this);
			return true;
		} catch(e) {
			console.error(cc.set('fg_red;, error while building router'), this.modulePath);
			console.log(e);
		}
	}

	getIndexFile() {
		return path.posix.join(this.root, this.htmlTemplate.destination);
	}

	async sendIndex(res) {
		var indexPath = path.posix.join(this.root, this.htmlTemplate.destination);
		res.sendFile(indexPath);
	}

	/**
	 * Call this method to add a code variable to the output html file. This
	 * variable will be added the namsespace for the app.
	 *
	 * @param {String} name the name of tyhe variable. This must be a valid
	 * 		JavaScript identifier.
	 * @param {*} value the value of the variable to set. This can be any type
	 * 		that can be serialized through JSON.
	 */
	 addCodeVariable(name, value) {
		this.codeVariables[name] = value;
	}

	/**
	 * Call this method to get the replacement value for ${codeVariables}. This
	 * will be the code that adds all the codeVariables to the namespace.
	 *
	 * @returns {String} the replacement value for the codeVariables template
	* 		variable;
	 */
	getCodeVariablesValue() {
		var names = Object.keys(this.codeVariables);

		// also include this process stuff, React seems to think it will always
		// be there. Consider moving this into a plugin/feature of some sort
		var env = process.env.NODE_ENV || 'dev';
		var codeBlock =
	`<script>
		window.process = {env: {NODE_ENV: "${env}"}};
`;

		if (names.length !== 0) {
			var members = names.map(function(name) {
					return `		${name}: ${JSON.stringify(this.codeVariables[name])},`
			}, this);

			codeBlock +=
`
		window.${this.ns} = {
			${members.join('\n')}
		}
`;
		}

		codeBlock +=
`	</script>
`
		return codeBlock;
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

	/**
	 * Call this method with to set specific options for live reload
	 *
	 * @param {Object} on set to true to turn on destination watching
	 * @property {Number} port set this to a port for as livereload port,
	 * 	defaults to 35800
	 * @property {("http"|"https")} protocol the protocol to use for the
	 * 	livereload websocket. default to 'http'
	 * @property hostname the hostname for the livereload websocket. defaults to
	 * 	'localhost;
	 * @property {Object} https if this has a value, it will be set as the http
	 * 	value in the livereload options
	 */
	setLiveReloadOptions(options) {
		this.liveReloadOptions = options;
	}

	/**
	 * Call this method with true to reload the browser when any files in the
	 * destination folder have changed.
	 *
	 * @param {Boolean} on set to true to turn on destination watching
	 */
	setLiveReload(on) {
		this.liveReload = on;
	}

	/**
	 * Call this method to set the template for the main application html. This
	 * template file must have the required replacement strings for basic
	 * functionality. Call setTemplateVariable to create application specific
	 * repalcement values.
	 *
	 * @param {String} source the relative path from the application root to the
	 * 		html template
	 * @param {String} destination the relative path to the destination file
	 */
	setHtmlTemplate(source, destination) {
		this.htmlTemplate = {source: source, destination: destination};
	}

	/**
	 * Call this method to set the value of a template variable. Template
	 * variables specify a location in the html template where the value will be
	 * inserted. To specify where the value should be inserted in the template
	 * file add the string "${variableName}" in the location.
	 *
	 * @param {String} name the name of the template variable
	 * @param {String} value that will be replaced
	 */
	setTemplateVariable(name, value) {
		this.templateVariables[name] = value;
	}

	/**
	 * Call this to add a configuration object to the application
	 *
	 * @param {Object} config a configuration object that will be added to the
	 * 		configuration store. Use get from @polylith/config to access
	 */
	addConfig(config) {
		this.configs.push(config);
	}

	/**
	 * Call this method to add specifications for application css files  These
	 * css files will be included in the html template. They will also be copied
	 * to the destination folder
	 *
	 * @param {String} root the relative path from the source root to the path
	 * 		to the origin of the caller. This will either be a feature root, or
	 * 		empty for the main application the source pathPaths specified in the
	 * 		resource spec are assumed to be relative to this.
	 * @param {ResourceSpecList} specs the specification for the css files. These
	 * 		will also be added as resources to be copied.
	 */
	addMainCss(root, specs) {
		specs = specs.map(function(spec) {
			return {root, spec}
		}, this)
		this.cssSpecs = [...this.cssSpecs, ...specs];
	}

	/**
	 * Call this method to find all the css files specified by the css specs
	 */
	async findMainCss() {
		var files = new Files(this.sourcePath, this.destPath, this.testPath)

	// Find all the files from the added css specs. Also add them to be copied
		this.cssSpecs.forEach(function(spec) {
			files.addResourceSpec(spec.root, spec.spec);
			this.files.addResourceSpec(spec.root, spec.spec);
		}, this)

		var expanded = await files.findAllFiles();
		var keys = Object.keys(expanded);
		keys.forEach(function(key){
			var file = expanded[key];
			this.cssFiles.push(file.uri)
		}, this);

		this.cssSpecs.map(function(spec) {
			this.files.addResourceSpec(spec.root, spec.spec);
			return spec.spec;
		}, this);
	}

	/**
	 * Call this method to add a list of resources that will be moved to the
	 * destination path when the application is built.
	 *
	 * @param {String} root the relative path from the source root to the path
	 * 		to the origin of the caller. This will either be a feature root, or
	 * 		empty for the main application the source pathPaths specified in the
	 * 		resource spec are assumed to be relative to this.
	 * @param {ResourceSpecList} resourceSpecs the copy specs
	 * 		for all the resources being added.
	 */
	addResources(root, resourceSpecs) {
		resourceSpecs.forEach(function(spec) {
			this.files.addResourceSpec(root, spec);
		}, this)
	}

	/**
	 * Call this method to add a feature to the application. This method is
	 * given a path to the root of the feature. At build time the builder will
	 * look in the feature directory for a file named build.js and if found
	 * import it and call the default function passing it a pointner to this
	 * object.
	 *
	 * If there is no build.js file the builder will look for a build.json file.
	 * If present that json will be loaded and used to build the feature.
	 *
	 * If that is not found it will look for an index.js file, and if found it
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
	 * This is called by rollup if no manual chunk specifiers are added,
	 *
	 * @param {String} filename this is the filename of the current file being
	 * 		processed by rollup
	 *
	 * @returns {String} the chunk name if there is a match
	 */
	defaultManualChunks(filename) {
		if (filename.includes('node_modules')) {
			return 'vendor';
		}
	}

	/**
	 * This is called by rollup when manual chunk specifications have been added
	 * as an array.
	 *
	 * @param {String} filename this is the filename of the current file being
	 * 		processed by rollup
	 * @returns {String} the name oo the chunk if there is a matching chunk
	 * 		name specifier
	 */
	handleManualChunksArray(filename) {
		var posixFilename = forceToPosix(filename);
		var result = this.manualChunks.find(function(spec) {
			return posixFilename.includes(spec.includes);
		})

		if (result) return result.name;
	}

	/**
	 * This is called by rollup when the manual chunk specifiers are functions.
	 * Each registered function is called in the reverse order to how they were
	 * added.
	 *
	 * @param {String} filename this is the filename of the current file being
	 * 		processed by rollup
	 * @returns the chunk name if any of the callbacks return one
	 */
	handleManualChunksCallbacks(filename) {
		var posixFilename = forceToPosix(filename);
		if (this.manualChunks.length === 0) {
			return this.defaultManualChunks(posixFilename);
		} else {
			for (chunk of this.manualChunks) {
				var result = chunk(posixFilename);
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
	 * @param {Boolean} forTest true if building test features
	 */
	async loadFeature(root, forTest) {
		var featurePath = path.posix.join(this.sourcePath, root);
		var indexPath = path.posix.join(featurePath, forTest ? 'spec.js' : 'index.js')
		var builderPath = path.posix.join(featurePath, forTest ? 'test.js' : 'build.js');
		var jsonPath = path.posix.join(featurePath, forTest ? 'test.json' : 'build.json');

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
				console.error(cc.set('fg_red', 'error while building feature'), root);
				console.log(e);
			}

		// second priority is a build configuration file.
		} else if (jsonExists) {
			try {
				let content = JSON.parse(await readFile(jsonPath));

				let builder = new ConfigFeature(content, root);
				await builder.build(this, forTest)
			} catch (e) {
				console.error(e);
				throw e;
			}

		// if neither exist, assume the index should be added
		} else if (indexExists) this.featureIndexes.push(indexPath);
	}

	/**
	 * Call this method to load the features for building the application
	 */
	async buildFeatures() {
		var features = this.features;

		for (let feature of features) {
			await(this.loadFeature(feature));
		}
	}

	/**
	 * Call this method to load the features when building the tests
	 */
	async testFeatures() {
		var features = this.features;

		for (let feature of features) {
			await(this.loadFeature(feature, true));
		}
	}

	/**
	 * Call this method to add a module that can be loaded during runtime
	 *
	 * @param {String} root the relative path from the source root to the
	 * 		feature directory. Loadable paths are assumed to be relative to this
	 * 		directory
	 * @param {String} name unique name of the loadable that will be passed to
	 * 		the load method
	 * @param {String} index the relative path from the source folder to the
	 * 		entry point of the loadable.
	 * @param {String} [prefix] if given, the prefix on services created in
	 * 		this loadable. When the loadable has been loaded, the start and
	 * 		ready methods will be called on all services starting with this
	 * 		prefix.
	 * @param {ResourceSpecList} [css] if give, it will be a list of resource
	 * 		specifications for the css files that will be included when the
	 * 		module is loaded
	 */
	async addLoadable(root, name, index, prefix, css) {
		var indexPath = path.posix.join(this.sourcePath, index);
		this.loadables.push({name, index: indexPath, prefix, root, css});
	}

	/**
	 * Call this method to locate all the css files for a loadable. These css
	 * files will be loaded into the browser when this loadable has been loaded
	 *
	 * @param {Loadable} loadable
	 */
	async findLoadableCss(loadable) {
		if (loadable.css) {
			var files = new Files(this.sourcePath, this.destPath, this.testPath)
			loadable.css.forEach(function(spec) {
				files.addResourceSpec(loadable.root, spec);
			}, this)

			var expanded = await files.findAllFiles();
			var keys = Object.keys(expanded);

			var cssUris = keys.map(function(key){
				var file = expanded[key];
				return file.uri
			}, this)

			loadable.css = cssUris;
		}
	}

	/**
	 * Call this method to build the template variable for the main html css
	 * files
	 *
	 * @returns {Promise<String>} the value of the mainCss template variable
	 */
	async buildMainCss() {
		var cssTags = '';

		await this.findMainCss();

		this.cssFiles.forEach(function(uri) {
			cssTags += `		<link rel="stylesheet" href="${uri}"></link>\n`
		}, this);

		return cssTags;
	}

	/**
	 * Call this method to create the configuration for testing the app
	 *
	 * @returns {Object} rollup configuration object
	 */

	async generateTestConfiguration() {
		var input = [this.fullSpecPath];

		// using a for loop because we are making an async call
		for (let loadable of this.loadables) {
		// find all the css files for the loadables
			await this.findLoadableCss(loadable);
			input.push(loadable.index);
		}

		var manualChunks = this.getManualChunks();

		var plugins = [
			resolve.nodeResolve({
				preferBuiltins: true,
				browser: true,
				extensions: ['.js', '.jsx']
			}),
			babel({
				presets: ['@babel/preset-react'],
				babelHelpers: 'bundled',
				extensions: ['.js', '.jsx'],
			}),
			commonjs(),
			nodePolyfills(),
			rollupJson(),
			jsconfig(this.root),
			svgr({svgo: false}),
			loadConfigs(this.configs),
			loader(this.loadables),
			features(this.featureIndexes),
			styles(),
			resources(this.name, this.files, true),
			watchLog(),
		];

		var config = {
			input : {
				input: input,
				plugins: plugins,
			},
			output : {
				output : {
					sourcemap: true,
					dir : this.testPath,
					format: 'es',
					assetFileNames: function(chunkInfo) {
						return '[name]-[hash][extname]';
					},
					entryFileNames: function(chunkInfo) {
						var entry = forceToPosix(chunkInfo.facadeModuleId);
						var found = this.loadables.find(function(loadable) {
							return loadable.index === entry;
						}, this);
						var exists = Boolean(found);

						if (exists) return (`${found.name}.js`);
						if (entry === this.fullSpecPath) {
							return `${this.name}.js`;
						}
						return '[name].js';
					}.bind(this),
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

	/**
	 * Call this method to create the configuration for building the app
	 *
	 * @returns {Object} rollup configuration object
	 */

	async generateBuildConfiguration() {
		var input = [this.fullIndexPath];
		var env = process.env.NODE_ENV || 'dev';

		// using a for loop because we are making an async call
		for (let loadable of this.loadables) {
		// find all the css files for the loadables
			await this.findLoadableCss(loadable);
			input.push(loadable.index);
		}

		var manualChunks = this.getManualChunks();
		var mainCss = await this.buildMainCss();
		var codeVariables = this.getCodeVariablesValue();
		var sourceMap = !this.polylithConfig.minify;

		this.templateVariables['mainCss'] = mainCss;
		this.templateVariables['codeVariables'] = codeVariables;

		var plugins = [
			resolve.nodeResolve({
				preferBuiltins: true,
				browser: true,
				extensions: ['.js', '.jsx']
			}),
			babel({
				presets: ['@babel/preset-react'],
				babelHelpers: 'bundled',
			}),
			commonjs(),
			nodePolyfills(),
			rollupJson(),
			jsconfig(this.root),
			svgr({svgo: false}),
			loadConfigs(this.configs),
			loader(this.loadables),
			features(this.featureIndexes),
			html({
				include: path.join(this.sourcePath, "**/*.html"),
			}),
			styles(),
			mainHTML({
				root: this.root,
				source: this.htmlTemplate.source,
				destination: this.htmlTemplate.destination,
				templateVars: this.templateVariables,
			}),
			resources(this.name, this.files, false),
			watchLog(),
		];

		if (this.polylithConfig.minify) plugins.push(terser());

		if (this.liveReload) {
			let plugin;

			// rollup-plugin-livereload always bases the protocol on the
			// webpage url. This is bad, here we override it
			if (this.liveReloadOptions) {
				let port = this.liveReloadOptions.port || 35800;
				let protocol = this.liveReloadOptions.protocol || 'http';
				let hostname = this.liveReloadOptions.hostname || 'localhost';
				let https = this.liveReloadOptions.https || null;
				let url = `${protocol}://${hostname}:${port}/livereload.js?snipver=1&port=${port}`;

				plugin = livereload({watch: this.destPath, https: https, clientUrl: url, port: port})
			} else  {
				plugin = livereload(this.destPath)
			}

			plugins.push(plugin)
		}

		var config = {
			input : {
				input: input,
				plugins: plugins,
			},
			output : {
				output : {
					sourcemap: sourceMap,
					dir : this.destPath,
					format: 'es',
					assetFileNames: function(chunkInfo) {
						return '[name]-[hash][extname]';
					},
					entryFileNames: function(chunkInfo) {
						var entry = forceToPosix(chunkInfo.facadeModuleId);
						var found = this.loadables.find(function(loadable) {
							return loadable.index === entry;
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

	/**
	 * Call this method to build the tests for the application
	 *
	 * @returns true if successful, false otherwise
	 */
	async test() {
		this.testing = true;
		if (!this.testPath || !this.spec) {
			console.error('Building tests is not properly configured.')
			return false;
		}

		await this.testFeatures();
		this.spec = await this.generateTestConfiguration();

		const bundle = await rollup.rollup(this.spec.input);
		await bundle.generate(this.spec.output);
		await bundle.write(this.spec.output);
		await bundle.close();

		return true;
	}

	/**
	 * Call this method to build the application
	 *
	 * @returns true if successful, false otherwise
	 */
	async build() {
		this.testing = false;
		await this.buildFeatures();
		this.spec = await this.generateBuildConfiguration();

		const bundle = await rollup.rollup(this.spec.input);
		await bundle.generate(this.spec.output);
		await bundle.write(this.spec.output);
		await bundle.close();

		return true;
	}

	/**
	 * Call this method to watch the source for changes, and rebuild when they
	 * happen.
	 */
	watch() {
		var watchConfig  = {
			...this.spec.input,
			output: [this.spec.output.output],
			...this.spec.watch,
		}

		const watcher = rollup.watch(watchConfig);
		watcher.on('event', function(event) {
			if (event.result) {
				event.result.close();
			}

			if (event.code === 'ERROR') {
				console.error(cc.set('fg_red', event.error))
			}

			if (event.code === 'BUNDLE_START') {
				console.log(cc.set('fg_blue', 'building...'));
			}

			if (event.code === 'BUNDLE_END') {
				console.log(cc.set('fg_blue', 'build complete'))
			}
		}.bind(this));
		return true;
	}

}
