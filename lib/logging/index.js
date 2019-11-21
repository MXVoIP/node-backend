const winston = require('winston');
const logger = winston.createLogger();

// the main logger
exports.configure = (options={}) => {
	logger.configure({
		// use syslog levels
		levels: winston.config.syslog.levels,
		// the default log level
		level: options.logLevel || 'info',
		// yes we want json formatting
		format: winston.format.json(),
		// include service info in the logs
		defaultMeta: {
			// use a sub object called "service"
			service: {
				// this should be set by any service
				// usually this is in the format "<service>-<environment>"
				name: options.appName,
				// this should be the version in the package.json
				version: options.appVersion,
				// the process id
				pid: process.pid,
				// the uptime of this service in milliseconds
				uptime: process.uptime(),
			}
		},
		// docker containers spit out to console
		transports: [
			new winston.transports.Console({
				format: winston.format.json(),
			})
		]
	});

	return logger;
};

// the request logger middleware
// takes an options object 
exports.requestLoggerMiddleware = (options) => {
	return require('./requestLogger')(logger, options);
};

// by default export the logger object
module.exports = logger;
