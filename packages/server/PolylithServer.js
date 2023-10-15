import express from "express";
import http from 'node:http';
import https from 'node:https';
import path from 'node:path/posix';
import { Server } from "socket.io";
import cors from 'cors';
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import compression from 'compression';
import cc from "@ondohers/console-colors";
import {workingDir} from './utils.js';

export class PolylithServer {
	constructor(options, dest) {
		this.options = options;
		this.staticRoot = dest;
		this.root = workingDir();
	}

	async setAppRoutes(apps) {
		for (let app of apps) {
			var router = express.Router({mergeParams: true});

			var success = await app.router(this.app, router);
			if (success) {
				this.app.use(app.getRouterRoot(), router);
			}
		}
	}

	async setupSocketIo(apps) {
		if (!this.socketIo) return;

		for (let app of apps) {
			await app.setSocketIo(this.socketIo);
		}
	}

	serve() {
		var roots = !Array.isArray(this.staticRoot) ? [this.staticRoot] : this.staticRoot;
		var staticOptions = {fallthrough: true}
		if (this.options.staticOptions) staticOptions = {...staticOptions, ...this.options.staticOptions}

		roots.forEach(function(root) {
			this.app.use(express.static(path.join(this.root, root), staticOptions));
		}, this)
	}

	async create(apps) {
		var {
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

			this.serve();

		if (httpsOptions)
			this.server = https.createServer(httpsOptions, this.app);
		else
			this.server = http.createServer(this.app);

		if (this.options.socketIo) {
			let options = this.options.socketIo === true ? {} : this.options.socketIo;
			this.socketIo = new Server(this.server, options);
			this.setupSocketIo(apps);
		}

		await this.setAppRoutes(apps);

	}

	start(port) {
		this.server.on('listening', function() {
			console.log(`Polylith server running on port ${cc.set('fg_green', port)}`)
		})
		this.server.listen(port);
	}
}
