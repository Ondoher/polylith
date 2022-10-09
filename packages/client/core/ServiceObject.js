import { EventBus } from './EventBus.js';

export class ServiceOject extends EventBus {
	constructor(name) {
		super('service:');

		this.name = name;
		this.bound = true;
		this.methods = [];
	}

	assignMethod(name, method) {
	// if there is already a listener, unbind and force invoking
		var bind = this.bound || !this.listeners[name];

		if (bind) {
			this[name] = method;
		} else {
		// this may be a reassignment, but that's okay.
			this[name] = this.invoke.bind(this, name)
		}

		this.methods.push(name);
	}

	unbindMethod(name) {
		if (this[name]) {
			this[name] = this.invoke.bind(this, name)
		}
	}

	unbind() {
		this.bound = false;
		this.methods.forEach(function(name) {
			this.unbindMethod(name);
		}, this)
	}

	implement(methods) {
		var names = Object.keys(methods);

		names.forEach(function(name) {
			if (methods[name]) {
				this.assignMethod(name, methods[name])

			// always add this as a listener, in case the method becomes unbound
				this.listen(name, methods[name]);
			}
		}, this);
	}

	invoke(name, ...args) {
		return this.fire(name, ...args);
	}

	async asyncInvoke(name, ...args) {
		return await this.asyncFire(name, ...args);
	}
}
