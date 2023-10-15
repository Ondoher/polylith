import path from 'node:path/posix';
import {readFile} from 'node:fs/promises';
import {ConfigApp} from '@polylith/builder';
import {PolylithServer} from '@polylith/server'
import {workingDir} from './utils.js';

/**
 * Call this method to get the default app from the polylith configuration
 *
 * @param {Object} config the current configuration object
 *
 * @returns the default application spec or undefined if there is none
 */
function findDefaultApp(config) {
	var spec = config.apps.find(function(spec) {
		return spec.default;
	});

	return spec;
}

/**
 * Call this function to get all the applications that should be acted on for
 * the current command.
 *
 * @param {String} name the app name specified from the command line
 * @param {Object} config the current polylith configuration object
 *
 * @returns {Array} the list of object specs to act on
 */
export function getAppSpecs(name, config) {
	var specs = [];
	var foundSpec;
	var defaultApp = findDefaultApp(config);

	if (config.all) {
		specs = config.apps;
	} else if (!name) {
		if (!defaultApp) {
			console.error('unable to find a default app to build')
			return [];
		}

		specs = [defaultApp];
	} else {
		foundSpec = config.apps.find(function(spec) {
			return spec.name === name;
		});

		if (!foundSpec) {
			console.error(`unable to find app ${name}`);
			return [];
		}
		specs = [foundSpec];
	}
	return specs;
}

/**
 * Call this method to read and parse a file with JSON content
 *
 * @param {String} filename the name of the json file to read
 * @returns {Object} the parsed json
 */
async function readJson(filename) {
	try {
		return JSON.parse(await readFile(filename, 'utf-8'));
	} catch (e) {
		console.warn(`unable to read configuration ${filename}`);
		console.warn(e.message);
	}
}

/**
 * Call this method to get the App object from the given app spec.
 *
 * @param {Object} spec the application spec from the polylith configuration
 * 		object
 * @param {Object} config the polylith configuration object
 *
 * @returns {App|Boolean} the application object, false if there ws an error
 */
async function getApp(spec, config) {
	var buildPath = path.join(workingDir(), config.builds);
	var filename = path.join(buildPath, spec.filename);
	var app;

	if (!spec.code) {
		var config = await(readJson(filename));
		if (!config) return false;
		app = new ConfigApp(spec, config, workingDir());
	} else {
		try {
			var res = await import(filename);
			if (!res.default) throw new Error('no default in application module')
			app = new res.default(config);
			if (!app.build && app.watch) throw new Error('application file is not an application module');
		} catch(e) {
			console.warn(`error loading app ${spec.name}`);
			console.warn(e.message);
			if (e.stack) console.warn(e.stack);
			return false;
		}
	}
	return app;
}

async function walkApps(name, config, cb) {
	var specs = getAppSpecs(name, config);
	var apps = [];

	// using for loop because we are making async calls
	for (let spec of specs) {
		let app = await getApp(spec, config);
		if (!app) continue;

		if (!cb || await cb(app)) apps.push(app)
	}

	return apps;
}

/**
 * Call this method to build all the applications specified on the command line
 *
 * @param {String} name the name of the application from the command line
 * @param {Object} config the polylith config
 * @param {Boolean} watch true if building for watch mode
 *
 * @returns {Promise.<Array.<App>>} the list of built apps
 */
export async function build(name, config, watch) {
	var apps = await walkApps(name, config, async function(app) {
		app.setLiveReload(watch);
		return await app.build();
	})

	return apps;
}

async function server(config) {
	var server = new PolylithServer(config, config.dest);
	await server.create(config.apps);
	server.start(config.port || '8081');
}

export async function watch(name, config) {
	var apps = await build(name, config, true);

	for (let app of apps) {
		await app.watch();
	}

	if (config.serve)
		await server({...config, apps: apps});
}

export async function run(name, config) {
	var apps = await build(name, config, false);

	await server({...config, apps: apps});
}

export async function serve(name, config) {
	var apps = await walkApps(name, config);

	await server({...config, apps: apps});
}

export async function test(name, config) {
	var apps = await walkApps(name, config, async function(app) {
		return await app.test();
	})

	if (config.watch) {
		for (let app of apps) {
			app.watch();
		}
	}

	return apps;
}
