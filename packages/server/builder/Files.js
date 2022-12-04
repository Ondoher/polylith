import fg from 'fast-glob';
import path from 'node:path/posix'
import {ensureDir} from 'fs-extra';
import { copyFile } from 'node:fs/promises';
import App from './App.js';
import {forceToPosix} from './utils.js'
import './types.js'
/**
 * create an instance of this class to specify and and copy files from source
 * to destination.
 */
export default class Files {
	/**
	 * Constructor for the Files class
	 *
	 * @param {String} dest the absolute filepath to the application's
	 *  destination directory
	 * @param {String} src the abolute path to the applications source
	 *  directory
	 *
	 * @param {String} src the abolute path to the applications test
	 *  directory
	 */
	constructor(src, dest, testDest) {
		this.dest = dest;
		this.testDest = testDest;
		this.src = src;
		/** @type {CopyInfoList} */
		this.files = {};
		this.testFiles = {};
		this.specs = [];
	}

	/**
	 * Call this method to add a copy specifier for resources to be copied. This
	 * will be called from either the application or from a feature build
	 * configuration or js file
	 *
	 * @param {String} root the originating path of the specifier. This is a
	 *  relative path from the project src path. This is probably the location
	 *  of the feature, or empty for the src path itself.
	 * @param {ResourceSpec} spec the specification for how to find and copy files
	 */
	addResourceSpec(root, spec) {
		spec.root = root;
		this.specs.push(spec);
	}

	/**
	 * call this method to generate the destination filename from the spec and
	 * the source filename
	 *
	 * @param {String} searchRoot the full path to the directory where the
	 * 		search started that found this file
	 * @param {ResourceSpec} spec the spec that found the file
	 * @param {String} srcFilename the full path to the source file
	 *
	 * @returns {String} the full path to the destination file
	 */
	makeDestination(searchRoot, spec, srcFilename) {
		var fullPath = searchRoot;
		var relativePath = srcFilename.slice(fullPath.length + 1);
		var destFilename = '';

		if (spec.keepNest) {
			destFilename = path.join(this.dest, spec.dest, relativePath);
		} else {
			destFilename = path.join(this.dest, spec.dest, path.basename(srcFilename));
		}

		return destFilename;
	}

	makeTestDestination(searchRoot, spec, srcFilename) {
		var fullPath = searchRoot;
		var relativePath = srcFilename.slice(fullPath.length + 1);
		var destFilename = '';

		if (spec.keepNest) {
			destFilename = path.join(this.testDest, spec.dest, relativePath);
		} else {
			destFilename = path.join(this.testDest, spec.dest, path.basename(srcFilename));
		}

		return destFilename;

	}

	/**
	 * Call this method once per spec to add a list of files to the complete
	 * list of all the files to be copied. If multiple files are found through
	 * different specs then the spec with the longest search root will take
	 * presidence, since it is the spec with the greatest specificity
	 *
	 * @param {String} searchRoot the full path to the directory where the
	 * 		search started that found this file
	 * @param {Array.<String>} files full paths to files that have been found
	 * @param {ResourceSpec} spec the spec that was used to find these files.
	 *
	 * @returns {CopyInfoList} the list of files found for this spec
	 */
	addFiles(searchRoot, files, spec) {
		/** @type {CopyInfoList} */
		var foundFiles = {};

		// the rule here is that files that are found by multiple specs will be
		// controlled according to the spec with the deepest nested search path.
		// Since file paths here are absolute this will always be based on the
		// string length.
		files.forEach(function(file) {
			file = forceToPosix(file);

			// reconcile conflicts
			if (this.files[file]) {
				var copyInfo = this.files[file];
				if (copyInfo.searchRoot.length > searchRoot.length) return;
			}

			var destination = this.makeDestination(searchRoot, spec, file);
			var testDestination = this.makeTestDestination(searchRoot, spec, file);
			var uri = destination.slice(this.dest.length + 1);

			foundFiles[file] = {
				name: file,
				searchRoot: searchRoot,
				destFilename: destination,
				testDestFilename: testDestination,
				uri: uri,
				spec: spec,
			}
		}, this);

		this.files = {...this.files, ...foundFiles}

		return foundFiles;
	}

	/**
	 * 	Call this method to get all the folders where files can copied from
	 *
	 * @returns {Array.<String>}
	 */
	getAllFolders() {
		var folders = 	this.specs.map(function(spec){
			return path.join(this.src, spec.root, spec.cwd);
		}, this);

		return folders;
	}


	/**
	 * Call this method to copy a single file into its destination location
	 *
	 * @param {String} file the full path of the file to be copied
	 */
	async copyOneFile(file, updated, forTest) {
		file = forceToPosix(file);

		var destination = forTest ? this.files[file] && this.files[file].testDestFilename : this.files[file] && this.files[file].destFilename;

		if (destination && updated) {
			console.log(`file ${file} updated, copied to ${destination}`);
			await copyFile(file, destination);
		}
	}

	/**
	 * Call this method to find all the files specified by a spec.
	 *
	 * @param {ResourceSpec} spec the specification for the files to find
	 *
	 * @returns {Promise.<CopyInfoList>} all the files that have been found so far.
	 */
	async findFiles(spec) {
		var searchRoot = path.join(this.src, spec.root, spec.cwd);
		var options = {
			cwd: searchRoot,
			ignore: ['**/node_modules'],
			absolute: true,
			onlyFiles: true,
			unique: true,
			dot: true,
		}
		var fullGlob = path.join(searchRoot, spec.glob);
		var files = await fg(fullGlob, options);

		this.addFiles(searchRoot, files, spec);

		return this.files;
	}

	/**
	 * Call this method to locate all the files to be found from all the copy
	 * specs that have been added.
	 *
	 * @returns {Promise<CopyInfoList>} the list of all files that have
	 * 		been found. This is also stored in the object variable this.files
	 */
	async findAllFiles() {
		if (this.filesFound) return this.files;

		// using a for loop here because we are making async calls
		for (let spec of this.specs) {
			await this.findFiles(spec);
		}

		this.filesFound = true;

		return this.files;
	}

	/**
	 * Call this method to copy all the files that have been specified by
	 * calling addResourceSpec to their destination directories
	 *
	 * @param {Boolean} forTest set true if copying files to test destination
	 */
	async copyFiles(forTest) {
		await this.findAllFiles();

		var filenames = Object.keys(this.files);

		// using a for loop because we are making async calls
		for (let srcFilename of filenames) {
			let destFilename = forTest ? this.files[srcFilename].testDestFilename : this.files[srcFilename].destFilename;
			let destFilePath = path.dirname(destFilename);

			try {
				await ensureDir(destFilePath);
				await copyFile(srcFilename, destFilename);
			} catch (e) {
				console.error(`Error copying file ${srcFilename} to ${destFilename}`);
				throw e;
			}
		}
	}

}
