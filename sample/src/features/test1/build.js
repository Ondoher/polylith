import {Feature} from '@polylith/builder';

class Test1Feature extends Feature {
	constructor () {
		super();
	}

	build(app) {
		app.addLoadable('test1', 'features/test1/dynamic/index.js', 'test1:');
	}
}

export default new Test1Feature();
