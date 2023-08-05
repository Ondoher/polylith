import { ServiceOject } from "./ServiceObject.js";
import { makeEventable} from "./Eventable.js";

/**
 * This calls is the implementation of the serices registry. There will be a
 * single global instance of this class.
 */
export class Registry {
	/** Constructor for the registry */
	constructor () {
		this.services = {};

		makeEventable(this);
	}

	/**
	 * Call this  method to construct a new service object.
	 * @param {String} [name] if pass this is the name of the sercice object
	 * 		service objects can be anonymous
	 * @returns the newly created sercice object
	 */
	createServiceObject(name) {
		var result = new ServiceOject(name);

		return result;
	}

	/**
	 * Call this method to register a new service object. The serice object can '
	 * be subscribed to fromn the registry by the given name.
	 *
	 * @param {String} name the namke of the object being registered.
	 * @param {ServiceOject} serviceObject the service object being registered.
	 */
	register(name, serviceObject) {
		this.services[name] = serviceObject;
	}

	/**
	 * Call this method to remove the service object from the registry. Any
	 * references thos this service will be retained.
	 *
	 * @param {String} name the name of the service to remove
	 */
	unregister(name) {
		delete this.services[name];
	}

	/**
	 * Call this method to get a reference to the service object.
	 *
	 * @param {String} name the registered name of the service object
	 * @returns {ServiceOject} the registered service object, ot false if it was
	 * 		not found.
	 */
	subscribe(name) {
		return this.services[name];
	}

	/**
	 * Call this method to create and register a service object and then
	 * implement methods on it. The created service object will be added as a
	 * member of the implementation object named serviceObject and the methods
	 * fire, listen and unlisten will be added as well. When called these
	 * methods will operate directly on the service object.
	 *
	 * @param {String} serviceName the name of the service being implemented.
	 * @param {Object} obj the implementation object for the given methods
	 * @param {Array.<String>} methodList the list of methods to add. These will
	 * 		be bound to the passed implementation object.
	 */
	makeService(serviceName, obj, methodList) {
		obj.serviceObject = new ServiceOject(serviceName);

		obj.serviceObject.implementOn(obj, 'fire');
		obj.serviceObject.implementOn(obj, 'listen');
		obj.serviceObject.implementOn(obj, 'unlisten');

		if (serviceName) {
			registry.register(serviceName, obj.serviceObject);
		}

		if (methodList) {
			var methods = {};

			methodList.forEach(function(methodName) {
				if (obj[methodName]) {
					methods[methodName] = obj[methodName].bind(obj);
				} else {
					console.warn('method', methodName, 'not implemented on service', serviceName ? serviceName : '<unnamed service>')
				}
			});

			obj.serviceObject.implement(methods);
		}
	}

	/**
	 * Call this method to extend the service object with a new list of methods.
	 * If not already impementated the methods fire, listen and unlisten will be
	 * added to the implementation object. If the service doesn't exist, it will
	 * be created. It will not be registered.
	 *
	 * @param {String} serviceName the name of the service being extended
	 * @param {*} obj the object implementing the methods
	 * @param {Array.<String>} methodList the list of methods to add. These will
	 * 		be bound to the passed implementation object.
	 */
	extendService(serviceName, obj, methodList) {
		var serviceObject = this.subscribe(serviceName);

		obj.serviceObject = serviceObject || new ServiceOject(serviceName);

		obj.serviceObject.implementOn(obj, 'fire');
		obj.serviceObject.implementOn(obj, 'listen');
		obj.serviceObject.implementOn(obj, 'unlisten');

		if (methodList) {
			var methods = {};

			methodList.forEach(function(methodName) {
				if (obj[methodName]) {
					methods[methodName] = obj[methodName].bind(obj);
				} else {
					console.warn('method', methodName, 'not implemented on service', serviceName ? serviceName : '<unnamed service>')
				}
			});

			obj.serviceObject.implement(methods);
		}
	}

	/**
	 * Call this method to invoke a method on all the passed service.
	 *
	 * @param {Array.<String>} serviceNames
	 * @param {String} which the name of the method to call
	 * @param {Function} if provided will call the function with the result of
	 * 		the service call
	 * @param  {...any} args the arguments to pass to the invoked method
	 * @returns {Promise.<any>} an array of any promises that were returned from
	 * 		the called methods.
	 */
	callAll(serviceNames, which, processResult, ...args) {
		var promises = [];

		serviceNames.forEach(function (name) {
			var serviceObject = this.services[name];
			if (!serviceObject) return;
			var result = serviceObject.invoke.apply(serviceObject, [which, ...args]);

			if (processResult) processResult(serviceObject, result)

			if (result && result.then) {
				promises.push(result);
			}
		}, this);

		return promises;
	}

	/**
	 * Call this method to add the wait methods to each service object
	 *
	 * @param {ServiceOject} serviceObject the service object to add the method
	 * 		to
	 * @param {*} result the result of the start method
	 */
	addWaitMethods(serviceObject, result) {
		var promise = result.then ? result : new Promise.resolve(true);

		serviceObject.waitStarted = function() {
			return promise;
		}
	}


	/**
	 * Call this method to verify that all services have their required services
	 * registered. Any services that does not have all requirements will be
	 * removed from the registry
	 */
	checkRequirements() {
		var more = true;

		while (!more) {
			let names = Object.keys(this.services);
			let toRemove = [];

			names.forEach(function(name) {
				var service = this.services[name];
				var required = service.required;

				var missing = required.some(function(requirement) {
					if (!requirement in this.services) {
						console.error(`reqiuirement ${requirement} for service ${name} missing. Service removed`)
					}
					return !(requirement in this.services);
				});

				if (missing) toRemove.push(name);
			}, this);

			more = toRemove.length != 0;
			toRemove.forEach(function(name) {
				delete this.services[name];
			})
		}
	}

	/**
	 * Call this method to initiate the startup sequence. The startup sequence
	 * is to first invoke the start method on all the specified registered
	 * services. Then, after all returtned promises have settled, the ready
	 * method will be invoked. The ready method is assumed to be synchronous
	 *
	 * @param {String} [prefix] if passed, only service that start with the
	 * 		given prefix will have the start process run.
	 *
	 * @returns a promise that will be resolved when the startup sequence is
	 * 		completed.
	 */
	async start(prefix = '') {
		var names = Object.keys(this.services);

		this.checkRequirements();

		var services = names.filter(function(name) {
			return name.indexOf(prefix) === 0;
		}, this);

		var promises = this.callAll(services, 'start', this.addWaitMethods.bind(this));
		return Promise.allSettled(promises)
			.then(function () {
				this.callAll(services, 'ready', false);
				this.fire('ready', prefix);
			}.bind(this));
	}
}

export var registry = new Registry();
