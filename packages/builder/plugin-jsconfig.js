import path from 'node:path/posix';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {forceToPosix, fileExists} from './utils.js'

/**
 * Matches pattern with a single star against search.
 * Star must match at least one character to be considered a match.
 *
 * @param patttern for example "foo*"
 * @param search for example "fooawesomebar"
 * @returns the part of search that * matches, or undefined if no match.
 */
function matchStar(pattern, search) {
	if (search.length < pattern.length) {
		return;
	}
	if (pattern === "*") {
		return search;
	}
	const star = pattern.indexOf("*");

	if (star === -1) {
		return;
	}

	const part1 = pattern.substring(0, star);
	const part2 = pattern.substring(star + 1);

	if (search.substr(0, star) !== part1) {
		return;
	}

	if (search.substr(search.length - part2.length) !== part2) {
		return;
	}

	return search.substr(star, search.length - part2.length);
}

async function findPathMatch(base, source, paths) {
	var patterns = Object.keys(paths);
	var source = forceToPosix(source);

	if (source.indexOf(base) === 0) return

	for (let pattern of patterns) {
		let searches = paths[pattern];
		let capture = matchStar(pattern, source);

		if (!capture) continue;
		if (!Array.isArray(searches)) continue;

		for (let search of searches) {
			var tryName = path.join(base, search.replace('*', capture));

			if (await fileExists(tryName)) {
				return tryName;
			}
		}
	}
}


function isRelative(name) {
	return name.slice(0, 2) === './' || name.slice(0, 3) === '../';
}

export default function jsconfig(root) {
	var jsConfig;
	var basePath;
	var paths;
	var previouslyMatched = {};

	async function readJsConfig() {
		var jsConfigPath = path.join(root, 'jsconfig.json');
		var exists = await fileExists(jsConfigPath);
		if (!exists) {
			jsConfig === false;
			return;
		}

		try {
			let content = JSON.parse(await readFile(jsConfigPath));
			basePath = content.compilerOptions.baseUrl;
			paths = content.compilerOptions.paths;
			jsConfig = content;
		} catch (e) {
			console.err(e)
			jsConfig = false;
		}
	}


	return {
		name: 'jsconfig',

		async resolveId (source, importer, options) {
			source = forceToPosix(source);

			if (previouslyMatched[source] !== undefined) return previouslyMatched[source];
			previouslyMatched[source] === null;

			if (jsConfig === undefined) await readJsConfig();
			if (!jsConfig) return null;

			if (isRelative(source)) return null;

			if (basePath) {
				var tryName = path.join(root, basePath, source);
				if (await fileExists(tryName)) {
					previouslyMatched[source] = tryName;
					return tryName;
				}
			}

			if (source[0] === '/') return null;

			if (paths) {
				if (source.indexOf(root) === 0) return null;

				var matchedPath = await findPathMatch(path.join(root, basePath), source, paths);

				if (matchedPath) {
					previouslyMatched[source] = matchedPath;
					return matchedPath;
				}
			}

			return null;
		}
	}
}
