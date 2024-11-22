import { ServiceObject } from "./ServiceObject.js";
import { registry } from "./Registry.js";

export class Service {
	constructor (name, overrideRegistry) {
		this.serviceObject = new ServiceObject(name);

		this.registry = overrideRegistry || registry;

		this.serviceObject.implementOn(this, 'fire');
		this.serviceObject.implementOn(this, 'listen');
		this.serviceObject.implementOn(this, 'unlisten');

		this.serviceName = name;

		if (name) {
			this.registry.register(name, this.serviceObject);
		}
	}

	implement (names) {
		var methods = {};

		names.forEach(function(name) {
			if (this[name]) {
				methods[name] = this[name].bind(this);
			} else {
				console.warn('method', name, 'not implemented on service', this.serviceName ? this.serviceName : '<unnamed service>')
			}
		}, this);

		this.serviceObject.implement(methods);
	}
}
