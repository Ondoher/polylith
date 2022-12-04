#!/usr/bin/env node

import minimist from 'minimist';
import { workingDir, forceToPosix, fileExists } from './utils.js';
import path from 'node:path/posix';
import { promisify } from 'node:util';
import child_process  from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { processManifest } from './templates.js';
import { watch, build, test } from './apps.js';

var exec = promisify(child_process.exec);
var argv = minimist(process.argv.slice(2))
var params = argv._;

// these are the default options
var clOptions = {
	multiple: false,
	dest: 'dist',
	src: 'src',
	builds: 'builds',
	all: false,
	code: false,
	index: true,
	react: true,
	watch: false,
}

var thisDir = path.dirname(forceToPosix(import.meta.url));

/**
 * Call this method to output the help file for the cli
 */
async function outputInstructions() {
	var filename = path.join(thisDir, 'instructions.txt');
	var instructions = await readFile(filename, 'utf-8');

	console.log(instructions);
};

/**
 * Call this method to see if the value of the given option is a boolean
 *
 * @param {String} val
 *
 * @returns {*} the value of the string.
 */
function checkBoolean(val) {
	var boolValues = {
		'true' : true,
		'false': false,
		'on': true,
		'off': false,
		'set': true,
		'clear': false
	}

	return boolValues[val] !== undefined ? boolValues[val] : val;
}

/**
 * Call this method to get the value of an option from the cli. It will convert
 * this value to a boolean if it can.
 *
 * @param {String} name the full name of the options
 * @param {String} short the short name of the option
 * @returns {*} the value of the option
 */
function getOption(name, short) {
	if (argv[name] !== undefined) return checkBoolean(argv[name]);
	if (argv[short] != undefined) return checkBoolean(argv[short]);
	return clOptions[name];
}

/**
 * Call this method to read the polylith configuration file. This is assumed to
 * be in the working directory.
 *
 * @returns {Object} the json parsed object from the config file, or the default
 * 		options if the file does not exist
 */
async function readConfig() {
	var filename = path.join(workingDir(), 'polylith.json');
	var exists = await fileExists(filename);
	var config = {};

	if (exists) {
		try {
			config = JSON.parse(await readFile(filename, 'utf-8'));
		} catch (e) {
			console.warn('unable to load polylith configuration file');
			console.warn(e.message);
		}
	}

	return config;
}

/**
 * Call this method to sort the top level keys of the given object.
 *
 * @param {Object} config the object to sort
 *
 * @returns {Object} a new object with the keys sorted
 */
function sortConfig(config) {
	var keys = Object.keys(config);
	var sorted = {};
	keys.sort();

	keys.forEach(function(key) {
		sorted[key] = config[key];
	});

	return sorted;
}

/**
 * Call this method to save the configuration object in the polylith config file
 *
 * @param {Object} config the configuration object
 */
async function writeConfig(config) {
	config = sortConfig(config);
	var filename = path.join(workingDir(), 'polylith.json');

	try {
		await writeFile(filename, JSON.stringify(config, null, '    '), 'utf-8');
	} catch(e) {
		console.error('unable to save polylith configuration file');
		console.error(e.message);
	}
}

/**
 * Call this method to get the current options. Order of precedence is default,
 * polylith.json and command line
 */
async function setOptions() {
	var config = await readConfig();

	clOptions = {...clOptions, ...config};

	clOptions.multiple = getOption('multiple', 'm');
	clOptions.dest = getOption('dest', 'd');
	clOptions.src = getOption('src', 's')
	clOptions.builds = getOption('builds', 'b')
	clOptions.all = getOption('all', 'a')
	clOptions.code = getOption('code', 'c')
	clOptions.index = getOption('index', 'i')
	clOptions.react = getOption('react', 'r')
	clOptions.watch = getOption('watch', 'w')

	// force multiple if we already have more than one app;
	if (config.apps && config.apps.length > 1) clOptions.multiple = true;
}

/**
 * Call this function to convert the string so that the first letter is
 * uppercase.
 *
 * @param {String} name the name
 * @returns {String} the given name with the first letter uppercased.
 */
function nameCase(name) {
	var letters = [...name];
	var first = letters.shift().toUpperCase();
	letters.unshift(first)
	return letters.join('');
}

/**
 * Call this method to convert the string to title case. This will separate the
 * individual parts of the normalized name and upper case the first letter of
 * each
 *
 * @param {String} name the name in normalized case
 * @returns {String} the title cased name
 */
function titleCase(name) {
	var parts = name.split('_');
	return parts.map(function(part) {
		return nameCase(part);
	}).join(' ');
}

/**
 * Call this function to convert the string to pascal case. Pascal case
 * separates each part of the name so the first letter is upper case. It assumes
 * the part separator is either '-' or '_'
 *
 * @param {String} name the name to be converted.
 * @returns {String} the name in Pascal case
 */
function pascalCase(name) {
	name = name.replace(/-/g, ' ');
	name = name.replace(/_/g, ' ');

	return name.split(' ').map(function(part, idx) {
		return nameCase(part);
	}).join('');
}

/**
 * Call this function to convert the string to camel case. Camel case separates
 * each part of the name with an uppercase letter except the first which has the
 * first letter lowercase.  It assumes the part separator is either '-' or '_'
 *
 * @param {String} name the name to convert
 * @returns {String} the camel case name
 */
function camelCase(name) {
	name = name.replace(/-/g, ' ');
	name = name.replace(/_/g, ' ');

	return name.split(' ').map(function(part, idx) {
		return idx === 0 ? part.toLowerCase() : nameCase(part);
	}).join('');
}

/**
 * Call this method to normalize the name so that each individual part is lower
 * case and separated by '_'. The name is assumed to be either separated with
 * spaces, -, or _; or is in camel case or pascal case.
 *
 * @param {String} name the name to normalize
 *
 * @returns {String} the normalized string which will be all lowercase with each
		part separated with '_';
 */
function normalizeCase(name) {
	if (!name) return;

	// default to pascal case, because we will break it into pieces based on
	// each part starting with an upercase letter.
	name = pascalCase(name);

	// separate the string by assuming each part starts with an uppercase letter
	var parts = [...name.matchAll(/([A-Z][a-z]*)/g)];

	parts = parts.map(function (part) {
		return part[1].toLowerCase();
	})

	return parts.join('_');
}

/**
 * Call this method to get all the replacements that can be used in template
 * files and template paths. This will include the app and name parts of the
 * command line, as names based on flags.
 *
 * The app and name parameters will ne saved in multiple casses for use in
 * different parts of the code. This is an example for name:
 * 	-	App = the name in pascal case
 *	-	aPp = the name in camel case
 *	-	APP_ = Upper snake case
 *	-	app_ = snake case;
 *	-	['App Title'] = title case
 *	-	app = the name as given from the command line
 *
 *
 * @param {Object} params the parameters from the command line
 * @returns {Object} an object with all the popssible replacement names
 */
function getNames(params) {

	var names = {}

	var app = '';
	var name = '';

	if (clOptions.multiple && !clOptions.all) {
		app = params[1];
		name = params[2];
	} else {
		app = params[1];
		name = params[2];
	}

	var normalizedApp = normalizeCase(app)
	var normalizeName = normalizeCase(name);
	if (app) {
		names.App = pascalCase(normalizedApp);
		names.aPp = camelCase(normalizedApp);
		names.APP_ = normalizedApp.toUpperCase();
		names.app_ = normalizedApp.toLowerCase();
		names['App Title'] = titleCase(normalizedApp);
		names.app = app;
	}

	if (name) {
		names.Name = pascalCase(normalizeName);
		names.nAme = camelCase(normalizeName);
		names.NAME_ = normalizeName.toUpperCase();
		names.name_ = normalizeName.toLowerCase();
		names['name title'] = titleCase(normalizeName);
		names.name = name;
	}

	names.dest = clOptions.dest;
	names.builds = clOptions.builds;
	names.src = clOptions.src;
	names.react = clOptions.react;
	names.path = clOptions.multiple ? '/' + app : '';

	return names;
}

/**
 * Call this method to run npm install
 */
async function runInstall() {
	await exec('npm install');
}

/**
 * Call this method to verify that the number of parameters is correct for the
 * current command
 *
 * @returns {Boolean} true if the number of parameters is correct
 */
function verifyParams() {
	var multiple = clOptions.multiple;
	var all = clOptions.all;
	var command = params[0];

	if (!command) return false;
	const requiredParams = {
		install : 0,
		app: multiple ? 1 : 0,
		builds: multiple && !all ? 1 : 0,
		clear: multiple && !all ? 1 : 0,
		run: multiple && !all ? 1 : 0,
		dev: multiple && !all ? 1 : 0,
	}

	return requiredParams[command] = params.length + 1;
}

/**
 * Call this method to update the polylith configuration file with the
 * added application information.
 *
 * @param {Object} names the names object
 * @param {Object} options the options object
 */
async function addAppJson(names, options) {
	var config = await readConfig();
	var filename = options.code ? `${names.app}.js` : `${names.app}.json`

	config.apps = config.apps || [];
	config.apps.push({
		name: names.name,
		filename: filename,
		code: options.code,
		default: !options.multiple,
	});

	await writeConfig(config);
}

/**
 * Call this method to test that the instance of polylith being run is  local to
 * the current project
 *
 * @returns {Boolean} true if the instance is local
 */
function checkLocalPolylith() {
	return (thisDir.indexOf(workingDir()) === 0);
}

/**
 * Call this function to execure the command from the command line
 */
async function run() {
	await setOptions();
	var config = await readConfig();

	if (!verifyParams() || argv.help || argv.h) {
		await outputInstructions();
		return;
	}

	switch (params[0])
	{
		case 'init': {
			let names = getNames(params);
			await processManifest('install', names, clOptions);
			await runInstall();
			break;
		}

		case 'app': {
			let names = getNames(params);
			await processManifest('app', names, clOptions);
			await addAppJson(names, clOptions);
			break;
		}

		case 'feature': {
			let names = getNames(params);
			processManifest('feature', names, clOptions);
			break;
		}

		case 'build': {
			await build(params[1], config, clOptions, false);
			break;
		}

		case 'watch': {
			await watch(params[1], config, clOptions)
			break;
		}

		case 'test': {
			await test(params[1], config, clOptions)
			break;
		}
	}
}

await run();
