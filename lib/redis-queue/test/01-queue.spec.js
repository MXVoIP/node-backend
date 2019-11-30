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

describe('Queue unit tests', function () {
	this.timeout(6000);
	let client, queue;
	before('Create redis connection', (done) => {
		client = connectToRedis(done);
	});

	it('should fail to create a new queue if the redisClient is missing', (done) => {
		try {
			queue = new Queue();
		}
		catch(error) {
			done();
		}
	});

	it('should fail to create a new queue if the redisClient is not in a connected state', (done) => {
		try {
			// fudge
			queue = new Queue({connected: false});
		}
		catch(error) {
			done();
		}
	});

	it('should fail to create a new queue if the queue name is missing', (done) => {
		try {
			queue = new Queue(client);
		}
		catch(error) {
			done();
		}
	});

	it('should fail to create a new queue if the max size is missing', (done) => {
		try {
			queue = new Queue(client, queueOptions.name);
		}
		catch(error) {
			done();
		}
	});

	it('should fail to create a new queue if the max size is <= 0', (done) => {
		try {
			queue = new Queue(client, queueOptions.name, 0);
		}
		catch(error) {
			done();
		}
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

		done();
	});

	it('should expose the number of pending events in the queue', (done) => {
		queue.getPending()
			.then((queueSize) => {
				assert.isNumber(queueSize, 'getPending should resolve a number');
				done();
			});
	});

	it('should expose the number of events actively being processed in the queue', (done) => {
		queue.getProcessing()
			.then((queueSize) => {
				assert.isNumber(queueSize, 'getProcessing should resolve a number');
				done();
			});
	});

	it('should be a NoOp to resume when already running', (done) => {
		assert.isTrue(queue.isRunning, 'queue is in a running state');
		assert.equal(queue.resume(), queue.isRunning, 'resume is a NoOp on a running queue');
		done();
	});

	it('should allow pausing', (done) => {
		assert.isTrue(queue.isRunning, 'queue is in a running state');
		queue.pause();
		assert.ok(queue.isPaused, 'queue is still paused');
		done();
	});

	it('should allow resuming after pause', (done) => {
		assert.isTrue(queue.isPaused, 'queue is paused');
		queue.resume();
		assert.isTrue(queue.isRunning, 'queue is in a running state');
		done();
	});

	it('should throw an error when setting status to unknown state', (done) => {
		try {
			queue.status = 'not a real status';
			/**
			 * this makes code coverage look wierd
			 * done('not a real status');
			 */
		} catch(error) {
			assert.ok(error instanceof Error, 'thrown error is of type Error');
			done();
		}
	});

	it('should not update status to the same', (done) => {
		assert.ok(queue.isRunning, 'queue should be in a running state');
		queue.status = 'running';
		done();
	});

	///////////////////////////////////////////////
	// testing after this point on a closed connection
	// will result in lots of errors
	///////////////////////////////////////////////
	it('should be able to close connection to redis', (done) => {
		assert.isTrue(queue.isRunning, 'queue is in a running state');
		queue.stop(() => {
			assert.isFalse(queue.isRunning || queue.isPaused, 'queue is not in a running state');
			done();
		});
	});

	it('should error on lost connection', (done) => {
		assert.isFalse(queue.isRunning || queue.isPaused, 'queue is not in a running state');
		// assert.notOk(client.llen(queue.key), 'underlying redis commands fail');
		queue.getPending()
			.catch((error) => {
				assert.ok(error, 'getPending should fail with a redis error');
				done();
			});
	});

	it('should error on lost connection', (done) => {
		assert.isFalse(queue.isRunning || queue.isPaused, 'queue is not in a running state');
		// assert.notOk(client.llen(queue.key), 'underlying redis commands fail');
		queue.getProcessing()
			.catch((error) => {
				assert.ok(error, 'getProcessing should fail with a redis error');
				done();
			});
	});

	it('should error when trying to close an already closed connection', (done) => {
		assert.isFalse(queue.isRunning || queue.isPaused, 'queue is not in a running state');
		try {
			queue.stop();
		} catch (error) {
			assert.ok(error instanceof Error, 'thrown error is of type error');
			done();
		}
	});

	// be sure to close redis before we're done
	after('Close redis connection', (done) => {
		try {client.quit(done);} catch(error){done();}
	});
});