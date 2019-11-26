
const schema = {
	title: 'redis queue',
	description: 'Durable queue built on top of redis streams',
	type: 'object',
	properties: {
		id: {type: 'string', format: ''}
	}
};

module.exports = class Queue {
	constructor(redisClient) {
		this.client = redisClient;
	}

	create()
};
