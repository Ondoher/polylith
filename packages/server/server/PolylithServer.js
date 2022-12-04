import express from "express";
import http from 'node:http';
import https from 'node:https';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import compression from 'compression';

export class PolylithServer {
	constructor(options) {
		this.options = options;
	}

	getRouter(plApp) {
		if (plApp.router) {
			plApp.router(this.app);
		}
	}

	watch(plApp) {
		plApp.watch();
	}

	serve(plApp) {
		this.app.use(express.static(plApp.destPath))
	}

	create() {
		var {
			apps,
			https : httpsOptions,
			cors : corsOptions,
			compression: useCompression,
			session,
		} = this.options;

		this.app = express();

		if (useCompression) this.app.use(compression({threshold: 5000 }))
		if (corsOptions) {
			this.app.use(cors(corsOptions));
			this.app.options('*', cors(corsOptions));
		}
		if (session && session.type === cookie) {
			app.use(cookieSession({
				name: session.name,
				keys: session.keys,
				maxAge: session.ttl,
			}))
		}

		this.app
			.use(cookieParser())
			.use(express.json())
			.use(express.urlencoded())
			.use(express.text())
			.use(express.raw())

		apps.forEach(function(app) {
			this.serve(app);
		}, this);

		if (httpsOptions)
			this.server = https.createServer(httpsOptions, this.app);
		else
			this.server = http.createServer(this.app);
	}

	start(port) {
		this.server.listen(port);
	}
}
