// the default response code logging levels
// override with the 'resCodeOverrides' option
const responseCodeLevels = {
	// 200 level responses are usually okay
	'2xx': 'info',
	// 300 level responses tend to just clutter things up
	'3xx': 'verbose',
	// 400 level responses aren't necessarily errors
	// but are more useful than 200 level responses
	'4xx': 'notice',
	// 500 level errors are always an alert. If you get these,
	// something is wrong and someone needs to look at it
	'5xx': 'alert'
};

/**
 * Determine the logging level of a given response code
 * @param {int} statusCode the status code to evaluate
 * @param {Object} overrides an object containing overrides
 * @returns {string} the Winston syslog logging level string
 */
const statusCodeLevel = (statusCode, overrides) => {
	// ensure we are dealing with a string
	statusCode = String(statusCode);
	// build a '[2-5]xx' 
	const value = `${Math.floor(statusCode/100)}xx`;
	// check if we have a match in the overrides
	// otherwise
	return overrides[statusCode] || responseCodeLevels[value];
};

const defaultOptions = {
	// an array of paths to ignore logging on
	// note: if you ignore '/foo', '/foo/bar' will also be ignored
	ignorePaths: [],
	// whitelist paths
	// if you ignore '/foo', whitelisting '/foo/bar' will log all 
	// requests to /foo/bar and sub paths
	whitelistPaths: [],
	// allow overrides of specific status codes - can also be used to override
	// a whole nxx range
	resCodeOverrides: {
		'201': 'info',
		'401': 'warning'
	}
};

module.exports = (logger, options={}) => {
	const logOptions = Object.assign({}, defaultOptions, options);

	return (req, res, next) => {
		// the response has finished so we are no longer blocking the client
		// still it may be beneficial to let this roll
		res.on('finish', () => {
			// check if we are ignoring any paths
			if (logOptions.ignorePaths.lenth) {
				// check if it is whitelisted
				if (!logOptions.whitelistPaths.includes(req.baseUrl) &&
					// see if it is in the ignore list
					logOptions.ignorePaths.includes(req.baseUrl)) return;
			}
			// build the log object
			const logObject = {
				// make sure express-request-id is being used
				id: req.id,
				// the method of the request
				method: req.method,
				// the hostname used in the request
				host: req.hostname,
				// the source ip
				srcIp: req.ip,
				// this is the baseUrl - this may need to be updated
				path: req.baseUrl,
				// the size of the request
				reqSize: req.headers['content-length'] || 'n/a',
				// the size of the response
				resSize: res.getHeaders('Content-Length') || 'n/a',
				// there is a requirement here on @local-lib/response-time
				responseTime: res.locals.responseTime
			};
			// determine the log level based on status code
			const logLevel = statusCodeLevel(res.statusCode, logOptions.resCodeOverrides);
			// default to info
			const logFun = logger[logLevel] || logger.info;
			logFun(`${res.statusMessage}`,{http: logObject});
		});
		// don't forget to allow processing to continue once we setup
		// the on 'finish' response handler
		return next();
	};
};