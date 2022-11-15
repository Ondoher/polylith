var copied= {}

/**
 *
 * @param {Files} files the files object that specifies the resource files to
 *  copy
 * @returns {Object} the plugin
 */
export default function(name, files) {
	return {
		name: "main-html-resources",

		async generateBundle(outputOptions, bundleInfo) {
			// assets are not watched, never copy more than once
			if (copied[name]) return;
			return new Promise(async function (resolve, reject) {
				try {
					await files.copyFiles();
					resolve(true)
					copied[name] = true;
				} catch (e) {
					reject(e)
				}
			})
		}
	}
}
