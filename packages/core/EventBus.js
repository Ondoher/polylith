import * as uuid from 'uuid';

export class EventBus {
	constructor (prefix = '') {
		this.listeners = {};
		this.prefix = prefix;
	}

	listen (eventName, cb) {
		var listenerId = uuid.v4();
		var name = this.prefix + eventName;

		this.listeners[name] = this.listeners[name] || [];
		this.listeners[name].push({cb, listenerId});

		return listenerId;
	}

	unlisten(eventName, listenerId) {
		var name = this.prefix + eventName;
		var listeners = this.listeners[name] || [];

		var index = listeners.findIndex(function (listener) {
			return listener.listenerId === listenerId;
		}, this);

		// if found, remove it from the array
		if (index !== -1) {
			listeners.splice(index, 1);
		}
	}

	/*
		This will fire all of the listeners for an event.

		The first listener to return a value is the result of this method.
		If one or more listeners returns a promise, this method will return a promise that will resolve to the return result.
	*/
	fire(eventName, ...args) {
		var name = this.prefix + eventName;
		var listeners = this.listeners[name];
		var promises = [];
		var firstResult;

		if (!listeners) return;

		listeners.forEach(function(listener) {
			var result = listener.cb.apply(this, args);
			var isPromise = result && result.then;

			firstResult = firstResult !== undefined ? firstResult : (result !== undefined && !isPromise) ? result : undefined;
			if (isPromise) promises.push(result);
		}, this)

		// if there are no promises, just return the firstResult
		if (promises.length === 0) {
			return firstResult;
		}

		// if there are promises, wait until they have all completed, then return the first result, or the value of the first fulfilled promise
		return Promise.allSettled(promises)
			.then(function(results) {
				var promisesResult

				//report on errors
				results.forEach(function(callResult) {
					if (callResult.status !== 'fulfilled') {
						console.warn(callResult.reason);
					}
				}, this);

				var found = results.find(function(callResult) {
					return callResult.status === 'fulfilled' && callResult.value !== undefined;
				}, this);

				promisesResult = found ? found.value : undefined;

				return firstResult !== undefined ? firstResult : promisesResult;
			}.bind(this));
	}

	async asyncFire(eventName, ...args) {
		return await this.fire(eventName, ...args);
	}

	implementOn(obj, name) {
		obj[name] = this[name].bind(this);
	}
}
