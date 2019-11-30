// make sure to setup a .env file in the root of this library for tests
require('dotenv').config();
const redis = require('redis');
const randomBytes = require('crypto').randomBytes;
const assert = require('chai').assert;
const Queue = require('../queue');
const Producer = require('../producer');
const Consumer = require('../consumer');

const queueOptions = {
	name: 'unit-test:consumers',
	maxSize: 10,
	idleTimeout: 1
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

function* generateEvents(numEvents) {
	for (let count = 0; count < numEvents; count++) {
		yield {
			id: randomBytes(8).toString('hex'),
			timestamp: Date.now(),
			testArray: ['a', 'test', 'array', randomBytes(4).toString('hex')],
			testObj: {a: 'test', obj: 'value', rval: randomBytes(4).toString('hex')}
		};
	}
}

function randomEvent() {return generateEvents(1).next().value;}


describe('Consumer unit tests', () => {
	let client, queue, producer, consumer, activeTask;

	function clearQueue(cb) {
		client.del([queue.key, queue.workKey], () => {
			cb();
		});
	}

	before('Create redis connection', (done) => {
		client = connectToRedis(() => {
			queue = new Queue(client, queueOptions.name, queueOptions.maxSize);
			producer = new Producer(queue);
			done();
		});
	});

	it('should successfully create a new consumer', (done) => {
		consumer = new Consumer(queue, queueOptions.idleTimeout);
		assert.ok(consumer.queue.isRunning, 'queue is in a running state');
		assert.equal(consumer.queue.maxSize, queueOptions.maxSize, 'max size of queue was properly set');
		assert.equal(consumer.idleTimeout, queueOptions.idleTimeout, 'idleTimeout was properly set');
		done();
	});

	it('should handle events', (done) => {
		consumer.on('redisError', (error) => {
			assert.isTrue(error instanceof Error, 'redis error events send Error objects');
		});

		consumer.on('idleTimeout', () => {
			assert.isTrue(consumer.queue.isRunning, 'queue is still running and not paused on idleTimeout');
		});

		consumer.on('pop', (task) => {
			assert.isObject(task, 'consumed a task');
		});

		consumer.on('ack', (numAcked) => {
			assert.isNumber(numAcked, 'consumer ACK event should respond with a number');
		});

		done();
	});

	it('should idle timeout when no events are queued', (done) => {
		consumer.pop().then((reply) => {
			assert.equal(reply, 0, 'consumer should respond with 0 when idle timeout');
			assert.isTrue(queue.isRunning, 'queue is in a running state');
			assert.isTrue(producer.queue.isRunning, 'queue is in a running state');
			assert.isTrue(consumer.queue.isRunning, 'queue is in a running state');
			done();
		});
	});

	it('should be able to consume events as they are produced', (done) => {
		producer.push(randomEvent())
			.then(() => {
				consumer.pop()
					.then((task) => {
						// track the task we are working on
						activeTask = task;
						let logLength = task.taskWrapper.log.length;
						activeTask.startProcessing();
						assert.ok(activeTask.taskWrapper.log.length > logLength, 'processing a task adds log entries');
						logLength = activeTask.taskWrapper.log.length;
						activeTask.endProcessing();
						assert.ok(activeTask.taskWrapper.log.length > logLength, 'processing a task adds log entries');
						assert.ok(activeTask.data, 'task data has been produced');
						assert.ok(task.taskWrapper, 'consumed task should have a taskWrapper');
						done();
					})
					.catch((error) => {done(error);});
			})
			.catch((error) => {done(error);});
	});

	it('should be able to ACK the task', (done) => {
		consumer.ack(activeTask)
			.then((numAcked) => {
				assert.equal(numAcked, 1, 'the active task should have been acked');
				done();
			})
			.catch((error) => {done(error);});
	});

	///////////////////////////////////////////////////////
	// these need to be the last tests since they
	// close the underlying redis connection
	///////////////////////////////////////////////////////
	it('redis connection can be closed', (done) => {
		client.quit(() => {
			done();
		});
	});

	it('should reject on error when pop is called with no connection to redis', (done) => {
		consumer.pop()
			.then(() => {
				done('pop should throw redisError');
			})
			.catch((error) => {
				assert.ok(error instanceof Error, 'redis error received when connection is lost');
				done();
			});
	});
	
	it('should reject on error when ack is called with no connection to redis', (done) => {
		consumer.ack(activeTask)
			.then(() => {
				done('pop should throw redisError');
			})
			.catch((error) => {
				assert.ok(error instanceof Error, 'redis error received when connection is lost');
				done();
			});
	});

	// be sure to close redis before we're done
	after('Close redis connection', (done) => {
		try {
			clearQueue(() => {client.quit(done);});
		}
		catch(err) {
			done();
		}
	});
});