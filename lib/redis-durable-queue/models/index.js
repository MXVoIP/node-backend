
module.exports = class Manager {
	constructor(redisClient) {
		this.client = redisClient;
		this.client.on('reconnecting', this.onReconnect.bind(this));
		this.client.on('error', this.onError.bind(this));
		this.client.on('end', this.onEnd.bind(this));
	}

	

};
