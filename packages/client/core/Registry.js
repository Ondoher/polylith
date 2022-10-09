import { ServiceOject } from "./ServiceObject";
import { makeEventable} from "./Eventable";

class Registry {
	constructor () {
		this.services = {};

		makeEventable(this);
	}

	createServiceObject(name) {
		var result = new ServiceOject(name);

		return result;
	}

	register(name, serviceObject) {
		this.services[name] = serviceObject;
	}

	unregister(name) {
		delete this.services[name];
	}

	subscribe(name) {
		return this.services[name];
	}

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

	callAll(serviceNames, which, ...args) {
		var promises = [];

		serviceNames.forEach(function (name) {
			var serviceObject = this.services[name];
			if (!serviceObject) return;

			var result = serviceObject.invoke.apply(serviceObject, [which, ...args]);
			if (result && result.then) {
				promises.push(result);
			}
		}, this);

		return promises;
	}

	async start(prefix = '') {
		var names = Object.keys(this.services);

		var services = names.filter(function(name) {
			return name.indexOf(prefix) === 0;
		}, this);

		var promises = this.callAll(services, 'start');
		return Promise.allSettled(promises)
			.then(function () {
				this.callAll(services, 'ready');
			}.bind(this));
	}
}

export var registry = new Registry();
