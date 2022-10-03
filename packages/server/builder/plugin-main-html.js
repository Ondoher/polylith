import escapeStringRegexp from 'escape-string-regexp';
import {ensureFile} from 'fs-extra';
import path from 'path/posix';
import {readFile, writeFile} from 'node:fs/promises';

const INVALID_ARGS_ERROR =
  "[plugin-main-html] You did not provide a template or target!";

/**
 * Takes an HTML file as a template and replaces variables.
 * @param {Object} options The options object.
 * @return {Object} The rollup code object.
 */

function createScriptTags(scripts) {
	var tags = '';
	scripts.forEach(function(script) {
		var oneTag = `<script type="module" src="${script}"></script>\n`;
		tags += oneTag;
	});

	return tags;
}

export default function(options = {}) {
  var { root, source, destination, replaceVars } = options;

  return {
    name: "main-html-template",

    async generateBundle(outputOptions, bundleInfo) {
		return new Promise(async function (resolve, reject) {
			try {
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
				replaceVars["scripts"] = scripts;

				var sourceFilePath = path.join(root, source);
				var destinationFilePath = path.join(root, destination);

				// Read the file
				var content = await readFile(sourceFilePath, 'utf-8');
				if (replaceVars) {
					var varNames = Object.keys(replaceVars);
					varNames.forEach(function(name) {
						var replacement = replaceVars[name]
						var escapedName = escapeStringRegexp('${' + name + '}');
						var regex = new RegExp(escapedName, 'g');
						content = content.replace(regex, replacement);
					});
				}

				// write the injected template to a file
				await ensureFile(destinationFilePath);
				writeFile(destinationFilePath, content, 'utf-8');
				resolve();
			} catch (e) {
				reject(e);
			}
      });
    },
  };
}
