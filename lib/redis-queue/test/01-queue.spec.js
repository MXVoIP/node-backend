// make sure to setup a .env file in the root of this library for tests
require('dotenv').config();
const redis = require('redis');
const assert = require('chai').assert;
const Queue = require('../queue');

const queueOptions = {
	name: 'unit-test:queues',
	maxSize: 10
};

function connectToRedis(cb) {
	const client = redis.createClient({
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,
		prefix: process.env.REDIS_PREFIX,
		enable_offline_queue: false
	});
	client.on('ready', cb);
	return client;
}

describe('Queue unit tests', () => {
	let client, queue;
	before('Create redis connection', (done) => {
		client = connectToRedis(done);
	});

	it('should successfully create a new queue', (done) => {
		queue = new Queue(client, queueOptions.name, queueOptions.maxSize);
		assert.ok(queue.isRunning, 'queue is in a running state');
		assert.equal(queue.maxSize, queueOptions.maxSize, 'max size of queue was properly set');
		done();
	});

	it('should handle events', (done) => {
		queue.on('statusChange', (oldStatus, newStatus) => {
			assert.ok(newStatus, `"${newStatus}" events are handled`);
		});

		queue.on('redisError', (error) => {
			assert.isTrue(error instanceof Error, 'redis error events send Error objects');
		});

		queue.on('error', (error) => {
			assert.isTrue(error instanceof Error, 'queue error events send Error objects');
		});

		queue.on('redisEnd', () => {
			assert.notOk(client.llen('1'), 'redis has lost connection');
		});

		queue.on('redisReady', () => {
			assert.ok(client.connected, 'redis is in a ready state');
		});

		done();
	});

	it('should allow pausing', (done) => {
		assert.isTrue(queue.isRunning, 'queue is in a running state');
		queue.pause();
		assert.isTrue(queue.isPaused, 'queue is paused');
		done();
	});

	it('should allow resuming after pause', (done) => {
		assert.isTrue(queue.isPaused, 'queue is paused');
		queue.resume();
		assert.isTrue(queue.isRunning, 'queue is in a running state');
		done();
	});

	it('should be able to close connection to redis', (done) => {
		assert.isTrue(queue.isRunning, 'queue is in a running state');
		queue.stop(() => {
			assert.isFalse(queue.isRunning || queue.isPaused, 'queue is not in a running state');
			done();
		});
	});

	it('should error on lost connection', (done) => {
		assert.isFalse(queue.isRunning || queue.isPaused, 'queue is not in a running state');
		assert.notOk(client.llen(queue.key), 'underlying redis commands fail');
		done();
	});

	// be sure to close redis before we're done
	after('Close redis connection', (done) => {
		try {client.quit(done);} catch(error){done();}
	});
});