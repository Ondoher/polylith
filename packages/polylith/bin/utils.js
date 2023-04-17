import path from 'node:path/posix';
import {readFile, writeFile, stat} from 'node:fs/promises';
import {cwd} from 'node:process';

/**
 * call this function to force the file path to use posix notation and remove
 * all drive information.
 *
 *
 * @param {String} src the filename wqe
 * @returns {String} the new path
 */
export function forceToPosix(src) {
	src = src.replace('file:', '/');
	src = src.replace('///', '/');
	src = src.replace(/.*?:/, '');
	src = src.replace(/\\/g, '/');

	return src;
}

export function workingDir() {
	return forceToPosix(process.cwd());
}

export function fileToPath(filename) {
    filename = forceToPosix(filename);
    return path.dirname(filename);
}

/**
 * call this function to check if the given file exists
 *
 * @param {String} path the name of the file
 * @returns {Promise<Boolean>} true if the file exists
 */

 export async function fileExists(path) {
    try {
        await stat(path)
        return true;
    } catch (e) {
        return false;
    }
}
