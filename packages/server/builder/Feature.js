export default class Feature {
	constructor (root) {
		this.root = root;
	}

	async build(app) {
		this.app = app;
	}
}
