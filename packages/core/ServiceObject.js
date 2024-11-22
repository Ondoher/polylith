import { EventBus } from './EventBus.js';

/**
 * The registry creates an instance of this class for every created service.
 * Service implementations will extend this object by adding methods and events.
 * Service objects are eventable objects, and inherit from the EventBus object
 */
export class ServiceObject extends EventBus {
	/**
	 * Constructor for the service object
	 * @param {String} name the name of the service being registered.
	 */
	constructor(name) {
		super('service:');

		this.name = name;
		this.bound = true;
		this.methods = [];
		this.required = [];
	}

	/**
	 * Call this method to add a method to the serviceobject that will directly
	 * call the event listener for an event. This is a much faster
	 * implementation of event handling in the case where there is a single
	 * listener. If there is more than a single listener this method will
	 * fallback to calling fire.
	 *
	 * @private
	 * @param {String} name the name of the event being bound to a listener.
	 * 		This will be the name of the creted method
	 * @param {Function} method the function to call when the method is called
	 */
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

	/**
	 * Call this method to unbind the method and make it instead fire an event.
	 * when called
	 *
	 * @param {String} name the name of the method to unbind
	 */
	unbindMethod(name) {
		if (this[name]) {
			this[name] = this.invoke.bind(this, name)
		}
	}

	/**
	 * Call this method to unbind all methods and prevent future binding.
	 */
	unbind() {
		this.bound = false;
		this.methods.forEach(function(name) {
			this.unbindMethod(name);
		}, this)
	}

	/**
	 * Call this method to bind a number of methods  to the service object.
	 *
	 * @param {Object} methods a map of methods to implement. The key is the
	 * 		method name, the value is the method to call.
	 *
	 */
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

	/**
	 * Call this method to safely invoke a method. This is a semantic function
	 * 		to conceptually separate methods from events, although they are
	 * 		implemented the same.
	 *
	 * @param {String} name the name of the method
	 * @param  {...any} args the paramaters to pass
	 * @returns
	 */
	invoke(name, ...args) {
		return this.fire(name, ...args);
	}

	/**
	 * Call this method to add a list of service names that this service
	 * depends on
	 *
	 * @param {*} services array of services
	 */
	require(services) {
		this.required = [...this.required, ...services];

		this.required = [...new Set(this.required)];
	}



}
