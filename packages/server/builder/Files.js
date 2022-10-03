import fg from 'fast-glob';
import path from 'node:path/posix'
import {ensureDir} from 'fs-extra';

/**
 * @typedef {Object} CopySpec
 * @property {String} dest the relative path of the copy destination from the
 *  application's destination path.
 * @property {String} cwd the relative path from the spec root to search for
 *  files
 * @property {String} glob the search expression for the files to copy, in glob
 *  format
 * @property {Boolean} [keepNest] if true then the nesting of the found file
 *  relative to the cwd property will be retained when the file is copied.
 *  Defaults to false
 */

/**
 * @typedef {Object} FileSpec
 * @property {String} name the full path to the file being copied
 * @property {String} searchRoot the absolute path to where the search started
 * @property {CopySpec} spec the specifier for how to find and copy files
 */

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
	 * @param {String} src  the abolute path to the applications source
	 *  directory
	 */
	constructor(dest, src) {
		this.dest = dest;
		this.src = src;
		this.files = {};
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
	 * @param {CopySpec} spec the specification for how to find and copy files
	 */
	addCopySpec(root, spec) {
		spec.root = root;
		this.specs.push(spec);
	}

	/**
	 * Call this method once per spec to add a list of files to the complete
	 * list of all the files to be copied. If multiple files are found through
	 * different specs then the spec with the longest search root will take
	 * presidence, since it is the spec with the greatest specificity
	 *
	 * @param {Array<String>} files absolute filepaths of files that have been found
	 * @param {String} searchRoot the absolute path of the spec root
	 * @param {CopySpec} spec the spec that was used to find these files.
	 */
	addFiles(searchRoot, files, spec) {
		// the rule here is that files that are found by multiple specs will be
		// controlled according to the spec with the deepest nested search path.
		// Since file paths here are absolute tthis will always be based on the
		// string length.
		files.forEach(function(file) {
			// reconcile conflicts
			if (this.files[file]) {
				copyInfo = this.files[file];
				if (copyInfo.searchRoot.length > searchRoot.length) return;
			}

			this.files[file] = {
				name: file,
				searchRoot: searchRoot,
				spec: spec,
			}
		}, this)
	}

	/**
	 * Call this method to locate all the files to be found from all the copy
	 * specs that have been added
	 *
	 * @returns {Promise<Array<FileSpec>>} the list of all files. This is also
	 *  stored in the object variable this.files
	 */
	async findAllFiles() {
		// using a for loop here because we are making async calls
		for (let idx = 0; idx < this.specs.length; idx++) {
			let spec = this.specs[idx];
			let searchRoot = path.join(this.src, spec.root, spec.cwd);
			let options = {
				cwd: searchRoot,
				ignore: ['**/node_modules'],
				absolute: true,
				onlyFiles: true,
				unique: true,
				dot: true,
			}
			let fullGlob = path.join(searchPath, spec.glob);
			let files = await fg(fullGlob, options);

			this.addFiles(searchRoot, files, spec);
		}

		return this.files
	}

	/**
	 * Call this method to copy all the files that have been specified through
	 * addCopySpec
	 */
	async copyFiles() {
		await this.findAllFiles();

		var filenames = Object.keys(this.files);

		// using a for loop because we are making async calls
		for (let idx = 0 ; idx < filenames.length; idx++) {
			let srcFilename = filenames[idx];
			let spec = this.files[srcFilename].spec;
			let relativePath = this.srcFilename.slice(this.files[srcFilename].searchRoot.length);
			let destFilename = '';

			if (spec.keepNest) {
				destFilename = path.join(this.dest, spec.dest, relativePath);
			} else {
				destFilename = path.join(this.dest, spec.dest, path.basename(srcFilename));
			}

			// we will override existing destination files. This could have
			// unintended consequences
			try {
				console.log(`copying ${srcFilename} to ${destFilename}`);
				/*
					await ensureDir(path.dirname(destinationFilePath));
					await fs.copyFiles(srcFilename, destFilename);
				*/
			} catch (e) {
				console.error(`Error copying file ${srcFilename} to ${destFilename}`);
				throw e;
			}
		}
	}

}
