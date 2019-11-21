const pkgJson = require('../package.json');

const appNamePattern = /^@local-(:?lib|service|util)\/(.*)$/i;
const appName = pkgJson.name.match(appNamePattern)[1];

module.exports = {
	// the application
	app: {
		// override this in custom-environment-variables
		appName: appName,
		appVersion: pkgJson.version
	},
	// logging options
	logging: {
		appName: appNamePattern,
		appVersion: pkgJson.version,
		logLevel: 'info'
	},
	// request logging options
	requestLoggerOptions: {
		ignorePaths: ['/metrics'],
		whitelistPaths: [],
		resCodeOverrides: []
	},
	// redis connection options
	redisOptions: {
		host: 'localhost',
		enable_offline_queue: false
	}
};