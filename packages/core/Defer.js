
export default class Defer {
	constructor()
	{
		this.promise = new Promise(function(resolve, reject)
		{
			this.resolve = resolve;
			this.reject = reject;
		}.bind(this));
	}
}
