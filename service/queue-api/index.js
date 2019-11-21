// use a .env file to set environment variables
// useful with kubernetes configmaps instead of passing
// actual environment variables
require('dotenv');
// config will throw an error if we look for a value that doesn't exist
const config = require('config');
const express = require('express');
const requestId = require('express-request-id')();
const responseTime = require('@local-lib/response-time');
const logger = require('@local-lib/logging').configure(config.get('logging'));
const requestLogging = require('@local-lib/logging').requestLoggerMidleware(config.get('requestLoggerOptions'));
const app = express();

// default middleware
app.use(
	// request IDs
	requestId,
	// response time headers
	responseTime,
	// body parsing
	express.json(), express.urlencoded({extended: true}),
	// log http requests
	requestLogging);

// route handling
app.use('/', require('./routes'));

const server = app.listen(config.get('app.listenPort'), () => {
	logger.info(`Listening at ${server.address().address}:${server.address().port}`);
});

module.exports = server;