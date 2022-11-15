import path from 'node:path/posix';
import {readFile, writeFile, stat} from 'node:fs/promises';

export function fixPath(src) {
	src = src.replace('file:', '');
	src = src.replace('///', '');
	src = src.replace(/.:/, '');
	src = src.replace(/\\/g, '/');

	return src;
}

async function fileExists(path) {
    try {
        await stat(path)
        return true;
    } catch (e) {
        return false;
    }
}
