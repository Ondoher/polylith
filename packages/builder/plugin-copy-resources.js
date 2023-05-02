var copied= {}

/**
 *
 * @param {Files} files the files object that specifies the resource files to
 *  copy
 * @returns {Object} the plugin
 */
export default function(name, files, forTest) {
	return {
		name: "copy-resources",

		buildStart() {
			var folders = files.getAllFolders();
			folders.forEach(function(name) {
				this.addWatchFile(name);
			}, this);
		},

		watchChange(file, event) {
			files.copyOneFile(file, true);
		},

		async generateBundle(outputOptions, bundleInfo) {
			// assets are not watched, never copy more than once
			if (copied[name]) return;
			return new Promise(async function (resolve, reject) {
				try {
					await files.copyFiles(forTest);
					resolve(true)
					copied[name] = true;
				} catch (e) {
					reject(e)
				}
			})
		}
	}
}
