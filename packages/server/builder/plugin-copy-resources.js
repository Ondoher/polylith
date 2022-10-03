/**
 *
 * @param {Files} files the files object that specifies the resource files to
 *  copy
 * @returns {Object} the plugin
 */
export default function(files) {
	return {
		name: "main-html-template",

		async generateBundle(outputOptions, bundleInfo) {
			return new Promise(async function (resolve, reject) {
				try {
					await files.copyFiles();
					resolve(true)
				} catch (e) {
					reject(e)
				}
			})
		}
	}
}
