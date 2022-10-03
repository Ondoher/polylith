import { ServiceOject } from "./ServiceObject";
import { registry } from "./Registry";

export class Service {
	constructor (name) {
		this.serviceObject = new ServiceOject(name);

		this.serviceObject.implementOn(this, 'fire');
		this.serviceObject.implementOn(this, 'listen');
		this.serviceObject.implementOn(this, 'unlisten');

		if (name) {
			registry.register(name, this.serviceObject);
		}
	}

	implement (names) {
		var methods = {};

		names.forEach(function(name) {
			if (this[name]) {
				methods[name] = this[name].bind(this);
			} else {
				console.warn('method', name, 'not implemented on service', this.name ? this.name : '<unnamed service>')
			}
		}, this);

		this.serviceObject.implement(methods);
	}
}
