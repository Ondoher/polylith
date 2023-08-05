# Polylith

Polylith is a lightweight framework that focuses on the overall shape of
the application and the building and serving of it. This framework does not
provide any UI code, or even mandate any particular architecture. It just
facilitates extreme decoupling of code through services and features, which
will be explained below.

## Rollup vs Webpack

Because of the specific requirements of building the application,
[Rollup](https://www.npmjs.com/package/rollup) is used as the core of the
build system rather than Webpack. These requirements include the creation of
synthetic modules and the automatic creation of chunks based on dependencies
shared between files that can be loaded dynamically. It also does tree shaking
to remove unused code.

The configuration of a build is high-level, focused on how the application is
constructed rather than the technology used. A build can be specified as either
a .json file, or though code.

## Command Line Interface

There is a command line interface for building and running a polylith
application. This can be installed globally to be run from the command line, and
locally to be accessed through npm scripts. To access this from the command line
install the module polylith globally, like this:

`npm install -g polylith`

Running the command polylith with no parameters will provide a description
of how to use it. However, most of the most common commands needed for
developing and running can be defined as scripts in the package.json file.

## jsconfig.json

Polylith will use the jsconfig.json file to find the location of imported
files. This is directly compatible with the format VS Code uses. This is
a commong definition of the jsconfig.json file.

```json
{
    "compilerOptions": {
        "module": "commonjs",
        "target": "es6",
        "baseUrl": "src/",
        "paths": {
            "*": ["*", "features/*", "components/*", "images/*", "icons/*",
            "common/*"]
        }
    }
}
```
## polylith.json

A single repository can define multiple applications that will be built
into the distribution and accessed with unique URLs once deployed. This
information and the base location of various directories such as the source
and distribution directory are set up in the polylith.json file. This file
should not need to be updated.

## Services

Services are the core of polylith, and the code necessary to implement and use
them is defined in the module @polylith/core. This module exports four things:
Service, Registry, registry, makeEventable.

### ServiceObject

An instance of ServiceObject is the external representation of a service as
retrieved from the registry. An object of this type is a different than the
implementation of the service, which extends the class Service.
ServiceObject is not exported from the core and cannot be directly created.
A ServiceObject is at its heart an EventBus. Use the methods, listen,
unlisten and firefor handling events from the service object. In principle,
all methods on a service are implemented as events, although for
performance reasons, under most circumstances, they will also be added as
function references on the service object. These methods will be described
below.

### Service

Implementations of a service extend the class Service. This class only has
two methods, the constructor and the method implement. However, the methods
listen, unlisten and fire will be added to the instance when the service is
constructed.

#### constructor
`constructor (name, overrideRegistry)`

- `name` is the name that will be used to retrieve this service from the
registry. If there is no name, then the service will not be added to the
registry. To get the service object from an unregistered service use the
member this.serviceObject. The name of this service is available in the
member this.serviceName.
- `overrideRegistry` is optional. If passed, this parameter will be used as
the registry associated with this instance. Otherwise, it will default to
the global registry instance. Accessing the registry should always be done
with the member this.registry.

### implement

`implement (names)`

Call this method to add methods to the service object.

- `names` This parameter is an array of strings. These strings are the names
of methods on this service that should be exposed as functions on the
service object. These functions will be added as members on the service
object bound to this. These functions will also be added as events.

### listen

`listen (eventName, cb)`

Call this method to listen for events on the service object. This method is
added to this service instance and is a reference to the listen method on
the service object. There can be multiple calls to listen, and each
listener will be called in the order it was added.

- `eventName` this is a string that is the name of the event to listen for.
- `cb` this is the function to call when the event is fired.

**returns**

This returns an opaque value which is a reference to this particular
listener. This reference will be used to when calling unlisten.

### unlisten

`unlisten(eventName, listenerId)`

Call this method to remove an event listener. This method is added to this
service instance and is a reference to the listen method on the service
object.

- `eventName` the name of the event to stop listening to.
- `listenerId` the value returned from the listen method.

### fire

`fire(eventName, ...args)`

Call this method to fire an event on the service object. This method is
added to this service instance and a is a reference to the fire method of
the service object.

- `eventName` this string is the name of the event to fire.
- `...args` all other parameters passed to the fire method are passed to the
event listeners.

**returns**

If any of the listeners return a promise, so will the fire method. This
promise will resolve when all promises returned from all listeners have
resolved. If there are no promise results from any of the listeners, it
will return with the value of the first listener that returned a result
other than undefined. If it returns a promise, that promise will be
resolved with the value of the first listener that returned or resolved
with a result. This value will be checked in the order the listeners were
added.

## Registry

The registry class manages a list of service objects. There is a global
instance of this class called registry, but it can also be instantiated for
use in unit tests.

### constructor

`constructor ()`

The constructor for the registry, it takes no parameters.

### subscribe

`subscribe(name)`

Call this method to get a service. This will be an instance of the
ServiceObject class.

- `name` the name of the service.

**returns**

The service object, or false if it was not found.

### start

`async start(prefix = '')`

Call this method to initiate the startup life cycle of the registered
services. This is an asynchronous method and should be called with await.

- `prefix` if defined it will only run the lifecycle methods on services with
names that start with that prefix.

## registry

This variable is exported from the @polylith/core module and is a reference
to the global registry. In most cases, access to the registry will be done
through the this.registry member of a service. Accessing the registry in a
component will be done using a [React Context object](https://reactjs.org/docs/context.html).

## makeEventable

`export function makeEventable(obj)`

Use this function to add the event methods listen, unlisten and fire to any
object. The implementation of this function creates a new EventBus object
and adds it to the object as eventBus. It then adds the event methods from
that bus to the object. This function has these parameters:

- `obj` the object to add the event methods to.

## Service Lifecycle

Two methods will be called on every service when the start method has been
called on a Registry instance.

### start

`start()`

If this method is implemented on the service, it will be called first. This
can be an asynchronous method. The start method will be called on all
services asynchronously and all must complete before the next lifecycle
step.

**returns**

If this method returns a promise, then the start step of the lifecycle will
wait until that promise has been resolved or rejected. This method will be
called on each service in the order they were registered.

### ready

`ready()`

If this method is implemented on the service, it will be called
synchronously after the start methods have completed on all registered
services. When this method is called all other services must be ready to be
used. This method will be called on each service in the order they were
registered.

## Example

This is an example of a service from
[Polylith Game Center](https://github.com/Ondoher/poly-gc-react) application.

```javascript
import {Service} from '@polylith/core';
import {load} from '@polylith/loader';

export default class LoaderService extends Service {
	constructor (service) {
		super('mahjongg-loader', service);
		this.implement(['ready', 'clicked']);
	}

	ready() {
		this.directory = this.registry.subscribe('directory');
		this.directory.add({image: 'images/mj/mj-tile.jpg', name: 'Mah Jongg', serviceName: 'mahjongg-loader'});
		this.pagesService = this.registry.subscribe('main-pages');
	}

	async clicked() {
		await load('mahjongg');
		this.pagesService.add('mahjongg', 'mj:controller');
		this.pagesService.show('mahjongg');
	}
}

new LoaderService();
```

## Application

The definition of an application can be setup by either extending an
instance of the Application class, or within a config file. The parts of an
application that can specified and the methods to access them are defined below.

### Basic Setup

The basic setup of an application contains this information: name, index,
application template and various directories. This information is provided
in the constructor of an application.

`constructor(name, config)`

The constructor of the Application class takes these parameters:

- `name` this is a string that identifies this application. It does not
represent a human readable name, just a short code to distinguish it from
other potential apps.
- `config` this is an object that specifies the rest of the basic information
for an application. This is the only required information for an
application, all other settings are optional.
  - `root` this the absolute path to the project directory. All other paths
are relative to this one, or relative to another path derived from this
path. So, for instance, the name of the index file might be specified as
"src/index.js". When deriving this in code, it is important not to hardcode
this path to a specific developer's machine but derive it relative to the
location of the build file. For example:
```javascript
var projectPath = path.join(path.dirname(import.meta.url), '../');
```
  - `index` this is the entry point of the application. All the code that is
bunded for the application follows from the imports on this entry point, as
well as the features, which are described below.
  - `spec` this optional string is the entry point for the tests. Like the
index, all the code that will be bundled for the tests follows from the
imports here, and the tests defined for features.
  - `dest` this specifies the base directory where the bundled files are
copied. When running the application this will be the root directory.
  - `testDest` this optional string specifies the directory where the bundled
files for testing are placed. When running the tests, this will be the root
directory.
  - `template` this object specifies the html file for the application. This
contains placeholders for where in the html file to place certain generated
html elements, such as the scripts and css files. This template will be
expanded on below. This object has these two fields:
    - `source` this is the location of the source template html file.
    - `destination` this is where the html file should be placed in the
destination directory.

### Templates

A template defines the html file that will be served to the browser. This
file contains placeholders for content that is generated during the build
process. These placeholders take the form ${\<name\>}. There are currently
two placeholders defined:

- `mainCss` this is where the link tags for the style sheets will be placed.
This should be placed inside the document head. The urls for these links
are specified by the resource definition for the CSS files. This is
described below.
- `scripts` this is where the top-level chunks for the application are placed
as script tags.

This is a sample html template:
```html
<html>
<head>
	<meta http-equiv="Content-Type" content="text/html;UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1 user-scalable=false"/>
${mainCss}
</head>
<body>
	<div id="dialog-overlay"></div>
	<div id="dialogs"></div>
	<div id="main-content" class="main-content"></div>
${scripts}
</body>
</html>
```
### Resources

A resource specifier defines a set of files that are not code that should
be to be moved to the application's destination directory, how to find
them, and where to put them. This is an object that contains these fields:

- `dest` this is a relative path in the destination folder where the
specified resourced should be copied.
- `cwd` this specifies the root directory where the searching should begin.
The directory here will be the basis for the directory for the copied files.
- `glob` this is a [glob](https://www.npmjs.com/package/fast-glob) that is
used to search for matching files.
- `keepNest` if true, the files found here will be moved to the destination
folder maintaining their relative path from the directory specified by cwd.
Otherwise, they are each copied directly to the path specified by dest.

An application maintains an array of these resource specifiers.

#### addResources

`addResources(root, resourceSpecs)`

Call this method of the Application object to add an array of resources to
the application. This method can be called multiple times. This method
takes two parameters:

- `root` this specifies the root of the resource spec. The cwd fields given
in the resource specifiers will be relative to this path. For the
application, this would usually be an empty string. For a feature it would
be the root of the feature. Features are described below.
- `resourceSpecs` this is an array of resource specifiers.

### CSS

CSS files are a special type of resource. These files will be loaded into
the html file with a link tag of type "stylesheet". When CSS files are
added to the application they will also be added as resources to be copied
to the destination directory.

#### addMainCss

`addMainCss(root, specs)`

Call this method of the Application object to add CSS files to be loaded
with the application. This method can be called multiple times. This method
takes two parameters:

- `root` this specifies the root of the resource spec. The cwd fields given
in the resource specifiers will be relative to this path. For the
application, this would usually be an empty string. For a feature it would
be the root of the feature. Features are described below.
- `resourceSpecs` this is an array of resource specifiers.

### Config

An application build can add data that will become accessible to the
application code using the get function exported from the @polylith/config
module.

#### addConfig

`addConfig(config)`

Call this method on the Application object to add an object that can be
accessed in the application JavaScript. It takes one parameter:

- `config` this is an object that will be [deepmerged](
https://www.npmjs.com/package/deepmerge) into the config data available to
the application code.

#### get

`function get(key)`

This method is not part of the application object but is exported by the
module @polylith/config and used by the application code which calls it to
get configuration data that has been added as part of the application
build. It takes one parameter:

- `key` the key is a dot separated string that specifies the nested object
path to the config data to get.

**Returns**

The result of this function is the value of the configuration data at that
key. If the key does not specify configuration data, the function will
return undefined and a warning will be output to the console.

### Features

A feature is an isolated set of functionality that the main application has
no dependencies on. It is described in more detail below. An application
adds features by referencing the base directory of the feature. The files
in that directory will specify the details of building it.

#### addFeature

`addFeature(feature)`

Call this method of the Application object to add a feature. It takes one
parameter:

- `feature` this string is the path to the feature, which is relative to the
application source directory.

#### Including Features

To include all the features specified in the application build, the primary
index file of the application has to import the module @polylith/features.

### Loadables

A loadable is a module that can be imported dynamically at runtime. A
loadable is specified with an index file and referenced with a name. In
addition to importing the module, a loadable can define CSS files that
should be loaded with it, and a service prefix. The prefix will be used to
run the service lifecycle on all the registered services that start with
that prefix.

#### addLoadable

`async addLoadable(root, name, index, prefix, css)`

Call this method of the Application object to add a new loadable module to
the application. It takes these parameters:

- `root` a relative path from the source root to the other directories
specified here.
- `name` the name that will be used to reference this loadable.
- `index` the path to the entry point of this loadable. It will be the
imports that follow from this entry point that defines the code that will
be loaded at runtime.
- `prefix` if specified, then after loading the module, all the services that
start with this string will go through their lifecycle methods.
- `css` if specified is an array of resource specs for the css files to load
with this loadable. Paths here will be relative to the specified root.

#### load

`export async function load(name)`

This function is not part of the application object but is exported from
the module @polylith/loader. From the application code, call this method
asynchronously to load the module. It takes one parameter:

- `name` this string is the name specified in the call to addLoadable.

**Returns**

This method returns a [module namespace object](
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import#module_namespace_object).
This can be used to access the exports of the imported module.

### Chunks

Polylith uses [Rollup](https://rollupjs.org/) as its bundling system.
[Chunks](https://rollupjs.org/tutorial/#code-splitting) are divisions of
code that have been split out into individual entry points. Rollup will
automatically create chunks based on dynamic imports but can also be given
rules to manually split code.

`addManualChunk(spec)`

Call this method of the Application object to add a specifier for how to
split code. If no manual chunks specifiers are added, then the default is
to split any module that includes "node\_modules" in its path into a chunk
named "vendor".

- `spec` the type of this parameter can be one of object, function or array.
All manual chunk specifiers added with this method have to be of the same
type. If not, the previously added chunk specifiers will be removed and a
warning output to the console. The following is how polylith handles the
different types of chunk specifiers.
  - `array` - each element of the given array is an object that contains two
fields, includes and name.
    - `includes` this is a string. If the filename of the module being tested
includes this value it will be a match
    - `name` if there is a match, then this is the name of the chunk.
  - `function` - this is a function that will be passed the module name. If
it returns a value, that will be the name of the chunk.
  - `object` - this object will be shallow merged into the current object.
This object is passed directly to the [manualChunks](
https://rollupjs.org/configuration-options/#output-manualchunks) field in
the rollup configuration.

Chunks specifiers that have been added are evaluated in the opposite order
they were added, so that the most recent specifiers are evaluated first.

## Routing

When the application is run, Polylith instantiates an instance of an
[Express](https://expressjs.com/) server to deliver the application to a
browser. An application can add its own routes to this server.

### setRouterModule

`setRouterModule(modulePath)`

Call this method of the Application object to set a module that will be
loaded to add routes to the Polylith server.

- `modulePath` this is a path to a JavaScript file that will be imported to
add routes. This path is relative to the project root.

This module should export a default function that takes a router as a
parameter and returns that same router. This function will be called
asynchronously.

## Feature

A feature represents a discreet, high-level, set of functionality. In the Game
Center application each game is implemented as a feature. The code for a feature
should be isolated from all other features and interact with the application
only through services. The application itself should have no dependencies on a
feature, and there should be no repercussions from adding or removing one.

Polylith contains a number of facilities to assist this isolation.
Specifically, a feature can independently specify code than can be
dynamically imported at runtime, called a "loadable". It can specify its
own configuration data, its own resource files that will be copied into the
distribution folder, and CSS files that will be loaded with the application.

The code for a feature will exist in its own directory, usually nested
under a directory named 'src/features/'

The specifier for a feature can be set up in one of three ways. The first
is simply the entry point of the feature--usually index.js. All the code
for the feature will be determined from the imports of this file. The
second is through a configuration file, and last is code that will be
passed the application object and can call methods of that object to add
its requirements.

### build.json

The configuration file for a feature should be named build.json and be in
the root directory for that feature. This configuration can have these
fields:

- `index` this is the entry point for the feature, which is usually index.js.
The imports from this entry point will define the code included in the
feature.
- `config` this specifies an object that has feature specific configuration
data that will be merged into the main application's config data. This can
be accessed through the get function exported from @polylith/config
- `resources` this is an array of resource specifiers. This is documented in
the section above on the application.
- `css` this is also an array of resource specifiers but must be css files.
These files will be added to the application list of css files and loaded
with the application.
- `loadables` this is an array of loadable specifiers. A loadable is a module
that can be dynamically imported into the application at runtime. This is
documented in the section above on the application.

## Unit Testing

In addition to building an application, Polylith can also builds tests.
Tests are an alternate path through the source with a different entry point
and a different destination. The primary entry point for tests is specified
in the application setup. The code for which tests to run will follow from
the imports that result from this file. Features do not need to be included
here, as features can specify their own tests. The tests to run are not
determined using a file search but are done directly though imports.

### Application

The entry point and build destination for tests is defined in the
constructor of the application with these fields in the config parameters:

- `spec` this string is the entry point for the tests. Like the index, all
the code that will be bundled for the tests follows from the imports here,
and the tests defined for features.
- `testDest` this string specifies the directory where the bundled files for
testing are placed. When running the tests, this will be the root directory.

Both of these must be defined for tests to work.

### Features

As features are independent from the application, the tests for features
are defined independently. The features to test are the same features that
are included in the application build.

When building the tests for a feature, rather than looking for the files
build.js, build.json and index.js, to build a feature, it instead looks for
spec.js, test.js and test.json. if only spec.js is defined this will be the
entry point for the feature tests. A test config file has the same fields
as a build config file, except that the index refers to the testing entry
point. All the code that will be bundled for the tests follows from the
imports from the test entry point.

### Loadables

Loadables are ignored during testing, the code in a loadable should built
into the tests defined by the feature.

### Unit Testing Services

Because the basic unit of implementation is a service, Polylith has
provided a mechanism to test a service in isolation without needing to
import other dependencies. Doing this requires a little cooperation from
the implementation of a service. The module that implements a service
should export as the default the class that it defines it. A unit test can
construct an instance of that service and pass to it an alternate registry
that it seeds with mocks of all the service's dependencies. To create a new
registry, make a new instance of the Registry class.

### Jasmine/Karma

Although Jasmine is not a requirement, this is the testing framework that
has been used in all the Polylith. testing. And it is Karma that has been
used as a test runner.

Because the code to build the tests is handled by Polylith, there is no
need to configure Jasmine. This is a sample configuration that can be used
to run Karma during development testing. It is assumed here that the test
destination directory is "tests". Because the application is built using ES
modules, and karma is expecting its configuration as a CommonJS module, the
file name for this configuration must be karma.conf.cjs.

```javascript
module.exports = function(config) {
    config.set({
        basePath: '',
        frameworks: ['jasmine'],
        files: [
            {pattern: 'tests/\*\*/\*.css', included: false},
            'tests/\*\*/\*.js'
        ],
        plugins: [
            require('karma-jasmine'),
            require('karma-chrome-launcher'),
            require('karma-spec-reporter'),
            require('karma-jasmine-html-reporter')
        ],
        reporters: ['spec'],
        port: 9876,
        colors: true,
        client: {
            captureConsole: true,
        },
        autoWatch: true,
        browsers: ['ChromeHeadless'],
        singleRun: false,
        concurrency: Infinity,
    })
}
```
To build tests from the Polylith command line use this command.

`polylith test -a -w`

The -a flag is used to specify that tests should be run for all
applications. The -w flag will watch the source for changes and rerun the
build. To run Karma, enter this command.

`karma start --browsers ChromeHeadless karma.conf.cjs`

The test script defined in the package.json file will run these two
commands in a separate window. So, to run them use the command:

`npm test`

## Synthetic Modules

A synthetic module does not exist as an actual module that has its own
source but is generated at build time by Polylith. Although they do not
exist as standalone source, synthetic modules are imported like any other
module.

Because many of the features of the Polylith build systems are specified in
configuration rather than code, it uses synthetic modules to access them.

- @polylith/config
 All the configuration data that has been created during the build process
is collected by this synthetic module and added to the configuration store.
The function get is exported to access this data.
- @polylith/loader
 In order to properly generate the dependencies of a loadable module,
Rollup needs to know the exact location of the source. During build, Rollup
will modify the filename specified by a dynamic import(), to the file that
is copied the destination directory.

 Polylith generates the source for this synthetic module to add the
`import()` code for each loadable added to the build with the filename
provided in the specification of the loadable so that Rollup can find it.
It will also generate the code to load the CSS, and if a prefix is defined
run the lifecycle on any service added by this loadable.

 This module exports a single function named load that takes as it's only
parameter the name of the loadable that was giving during its setup. This
method should be called asynchronously:

```javascript
import {load} from '@polylith/loader';`

await load('mahjongg');
```

- @polylith/features
 To import the code for all the features added in the build, this synthetic
module should be imported in the entry point for the application. The code
generated for this module consists of imports to the entry points of all
the features added.
