import {App} from '@polylith/builder';

import server from 'node-static';
import http from 'http';
import path from "path/posix";

var projectPath = path.join(App.fileToPath(import.meta.url), '../');
class TestApp extends App {
	constructor() {
		super('test', projectPath, 'src/index.js', 'dist/test');
		this.setHtmlTemplate('src/templates/main.html', 'dist/test/test.html');
	}

	async getFeatures() {
		var featureList = [
			'features/test1',
			'features/test2',
		]

		return featureList;
	}
}

var app = new TestApp();
await app.build();

var file = new server.Server('../dist');

http.createServer(function (request, response) {
    request.addListener('end', function () {
        file.serve(request, response);
    }).resume();
}).listen(8080);
