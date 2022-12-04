import { ensureDir } from 'fs-extra';
import { readFile, writeFile } from 'node:fs/promises';
import { workingDir, forceToPosix, fileExists } from './utils.js';
import path from 'node:path/posix';

	var thisDir = path.dirname(forceToPosix(import.meta.url));

function replaceNames(text, names)
{
	var keys = Object.keys(names);
	keys.forEach(function(key) {
		var name = key;
		var value = names[key];
		var regEx = new RegExp(`\{${name}\}`, 'g');

		text = text.replace(regEx, value);
	});

	return text;
}

async function processOne(directory, spec, names) {
	var destFilename = path.join(workingDir(), spec.path);
	var destPath = path.dirname(destFilename);

	// if there is no template file, just create the destination directory
	if (!spec.template) {
		await ensureDir(destFilename)
		return;
	}

	var templatePath = path.join(thisDir, directory, '/templates/', spec.template);


	// create the directory if necessary
	await ensureDir(destPath);

	// do not overwrite existing files
	var exists = await fileExists(destFilename)
	if (exists) return;

	var template = await readFile(templatePath, 'utf-8');
	template = replaceNames(template, names);

	await writeFile(destFilename, template, 'utf-8');
}

async function readManifest(directory) {
	try {
		var filename = path.join(thisDir, directory, 'manifest.json');
		var manifest = await readFile(filename, 'utf-8');
		return JSON.parse(manifest);
	} catch(e) {
		return {}
	}
}

/**
 * Call this method to see if the options specified in the which condition are
 * set in the options object
 *
 * @param {String|Array} which the name of the option to check, or the options.
 * 		if it is an array then all conditions muxt be met
 * @param {Object} options the options object
 *
 * @returns {Boolean} true if the options are all true
 */
function matchOptions(which, options) {
	var conditions = !Array.isArray(which) ? [which] : which;

	return conditions.reduce(function(match, option) {
		match = match && typeof options[option] === 'boolean' ? options[option] : Boolean(options[option]);
		return match;
	}, true);
}

/**
 * Call this method to process a manifest file
 *
 * @param {String} directory the relative path of the maniest file
 * @param {Object} names an object with the names that can be replaced in the
 * 		paths and templates
 * @param {Object} options the options object
 */
export async function processManifest(directory, names, options) {
	var manifest = await readManifest(directory);

	// using a for loop here because we are making asynchronous calls
	for (let spec of manifest.files) {
		let run = true;

		// If there is a when conditional here, check it.
		if (spec.when) {
			run = matchOptions(spec.when, options);
		}
		// If there is a when-not conditional here, check it. Both when and
		// when-not must be true to execute
		if (spec['when-not']) {
			run = run && !matchOptions(spec['when-not'], options);
		}

		if (run) {
			spec.path = replaceNames(spec.path, names);
			await processOne(directory, spec, names);
		}
	}
}
