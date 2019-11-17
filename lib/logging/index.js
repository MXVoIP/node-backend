const winston = require('winston');
const logger = winston.createLogger({
	levels: winston.config.syslog.levels,
	level: process.env.LOG_LEVEL || 'info',
	format: winston.format.json(),
	defaultMeta: {
		service: {
			name: process.env.APP_NAME,
			version: process.env.APP_VERSION,
			pid: process.pid,
			uptime: process.uptime(),
		}
	},
	transports: [
		new winston.transports.Console({
			format: winston.format.json(),
		})
	]
});

exports.logger = logger;
exports.requestLogger = (options) => {
	return require('./requestLogger')(logger, options);
};