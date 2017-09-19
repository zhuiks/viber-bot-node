"use strict";

const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const stream = require('stream');

function Middleware(logger, messageValidatorService) {
	this._logger = logger;
	this._stream = this._createStream();
	this._buffer = null;

	this._app = new Router();
	this._app.use(bodyParser({
        enableTypes: ['text'],
        extendTypes: { text: "*/*" }
	}));

	this._validateMessageSignature(messageValidatorService);
	this._configureEndpoints();
}

Middleware.prototype.getIncoming = function() {
	return this._app.routes();
};

Middleware.prototype.getStream = function() {
	return this._stream;
};

Middleware.prototype._configureEndpoints = function() {
	const self = this;
	this._app.get("/ping", ctx => {
		ctx.body = "pong";
	});

	this._app.post("/", ctx => {
		self._logger.debug("Request data:", ctx.request.body);
		self._stream.push(ctx.request.body);

		if (self._buffer) {
			ctx.body = self._buffer;
		}
	});
};

Middleware.prototype._createStream = function() {
	const self = this;
	const duplexStream = new stream.Duplex();

	duplexStream._read = function noop() {};
	duplexStream._write = (chunk, encoding, done) => {
		self._buffer = chunk.toString();
		done();
	};
	return duplexStream;
};

Middleware.prototype._validateMessageSignature = function(messageValidatorService) {
	const self = this;
	this._app.use((ctx, next) => {
		const serverSideSignature = ctx.headers.X_Viber_Content_Signature || ctx.query.sig;
		if (!messageValidatorService.validateMessage(serverSideSignature, ctx.request.body)) {
			self._logger.warn("Could not validate message signature", serverSideSignature);
			return;
		}
		next();
	});
};

module.exports = Middleware;