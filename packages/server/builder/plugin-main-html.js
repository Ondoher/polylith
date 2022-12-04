import escapeStringRegexp from 'escape-string-regexp';
import {ensureFile} from 'fs-extra';
import path from 'path/posix';
import {readFile, writeFile} from 'node:fs/promises';

const INVALID_ARGS_ERROR =
  "[plugin-main-html] You did not provide a template or target!";

function createScriptTags(scripts) {
	var tags = '';
	scripts.forEach(function(script) {
		var oneTag = `<script type="module" src="${script}"></script>\n`;
		tags += oneTag;
	});

	return tags;
}

/**
 * Takes an HTML file as a template and replaces template variables with
 * assigned values
 *
 * @param {Object} options The options object.
 * @return {Object} The rollup plugin object.
 */
 export default function(options = {}) {

	var { root, source, destination, templateVars } = options;

	return {
		name: "main-html-template",

		async generateBundle(outputOptions, bundleInfo) {
			var includes = [];
			var names = Object.keys(bundleInfo);
			var scripts;

			if (!destination && !source) throw new Error(INVALID_ARGS_ERROR);

			names.forEach(function(name) {
				var entry = bundleInfo[name];
				if (!entry.isDynamicEntry) {
					includes.push(name);
				}
			});

			scripts = createScriptTags(includes);
			templateVars["scripts"] = scripts;

			var sourceFilePath = path.join(root, source);
			var destinationFilePath = path.join(root, destination);

			var content = await readFile(sourceFilePath, 'utf-8');

			if (templateVars) {
				var varNames = Object.keys(templateVars);
				varNames.forEach(function(name) {
					var replacement = templateVars[name]
					var escapedName = escapeStringRegexp('${' + name + '}');
					var regex = new RegExp(escapedName, 'g');
					content = content.replace(regex, replacement);
				});
			}

			// remove template vars that were not replaced
			content = content.replace(/\$\{.*?\}/, '');

			// write the injected template to a file
			await ensureFile(destinationFilePath);
			writeFile(destinationFilePath, content, 'utf-8');
		},
	};
}
