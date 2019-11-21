const onHeaders = require('on-headers');

/**
 * connect/express middleware to compute response time
 * sets res.locals.startAt, res.locals.responseTime
 */
module.exports = (req, res, next) => {
	res.local.startAt = process.hrtime();
	onHeaders(res, () => {
		const endAt = process.hrtime(res.local.startAt);
		res.local.responseTime = ((endAt[0] * 1e3) + (endAt[1] / 1e6)).toFixed(2);
		if (!this.getHeader('X-Response-Time')) {
			this.setHeader('X-Response-Time', res.local.responseTime);
		}
	});
	return next();
};
