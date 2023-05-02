/** @module types */

/**
 * This type defines how to locate a set of files that will be copied to the
 * dest folder.
 *
 * @typedef {Object} ResourceSpec
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
 * This type defines a list of ResourceSpec
 *
 * @typedef {Array.<ResourceSpec} ResourceSpecList
 */

/**
 * This defines the specification for a file that has been found from a
 * ResourceSpec
 *
 * @typedef {Object} CopyInfo
 * @property {String} name the full path to the file found
 * @property {String} searchRoot the absolute path to where the search started.
 * @property {String} destFilename the absolute path to where the file be copied
 * @property {String} uri the path to the file relative to the destination
 * 		directory. This can be used to reference the file from the output
 * 		application.
 * @property {ResourceSpec} spec the specifier used to locate this file
 */

/**
 * This type defines a list of CopyInfos
 *
 * @typedef {Object.<String, CopyInfo>} CopyInfoList
 */

/**
 * This specifies what is in a loadable object
 *
 * @typedef {Object} Loadable
 * @property {String} name this is the name the loadable will be known as. This
 * 		will be the string passed to the load function
 * @property {String} root the relative path from the source directory to the
 * 		root of the feature. All feature paths are assumed to be relative to
 * 		this
 * @property {String} index the absolute path to the loadables index file
 * @property {String} prefix if given then all services that begin with this
 * 		prefix will go through the start sequence when loaded
 * @property {ResourceSpecList|Array<String>} css is either the specification for
 * 		where to find the css files to load, or during build, an array of the
 * 		uris for each css file.
 */
