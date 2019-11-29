// make sure to setup a .env file in the root of this library for tests
require('dotenv').config();
const redis = require('redis');
const randomBytes = require('crypto').randomBytes;
const assert = require('chai').assert;
const Queue = require('../queue');
const Producer = require('../producer');

const queueOptions = {
	name: 'unit-test:producers',
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


describe('Producer unit tests', () => {
	let client, queue, producer;

	function clearQueue(cb) {
		client.del([queue.key, queue.workKey], (err, reply) => {
			cb();
		});
	}

	before('Create redis connection', (done) => {
		client = connectToRedis(() => {
			queue = new Queue(client, queueOptions.name, queueOptions.maxSize);
			done();
		});
	});

	it('should successfully create a new producer', (done) => {
		producer = new Producer(queue);
		assert.ok(producer.queue.isRunning, 'queue is in a running state');
		assert.equal(producer.queue.maxSize, queueOptions.maxSize, 'max size of queue was properly set');
		done();
	});

	it('should handle events', (done) => {
		producer.on('redisError', (error) => {
			assert.isTrue(error instanceof Error, 'redis error events send Error objects');
		});

		producer.on('maxSizeError', (error) => {
			assert.isTrue(error instanceof Error, 'producer error events send Error objects');
		});

		producer.on('push', (queueSize) => {
			assert.isNumber(queueSize, 'producer push events provide the current queue size');
		});

		done();
	});

	it('should allow pushing new events', (done) => {
		producer.push(randomEvent()).then((reply) => {
			assert.isNumber(reply, 'producer push events provide the current queue size');
			assert.isTrue(reply < queue.maxSize, 'queue has not reached its limit');
			done();
		});
	});

	it('should allow us to exceed the maximum queue size', (done) => {
		const eventIter = generateEvents(queue.maxSize);

		for (const rndEv of eventIter) {
			producer.push(rndEv);
		}

		setTimeout(() => {
			assert.isTrue(producer.queue.isPaused, 'producer is in a paused state after exceeding max queue size');
			done();
		}, producer.queue.maxSize * 100);
	});

	it('should pause the queue when max size has been exceeded', (done) => {
		assert.isTrue(producer.queue.isPaused, 'queue is in a paused state');
		producer.push(randomEvent())
			.then(() => {
				done('producer should not allow pushing new events when paused');
			})
			.catch((error) => {
				assert.ok(error, 'queue rejects pushing events when paused');
				// let's clear out the queue here directly because it makes sense
				clearQueue(done);
			});
	});

	it ('should allow resuming a paused queue', (done) => {
		assert.isTrue(producer.queue.isPaused, 'queue is in a paused state');
		producer.queue.resume();
		assert.isTrue(producer.queue.isRunning, 'queue is in a running state');
		done();
	});

	it('should allow pushing new events after resuming', (done) => {
		producer.push(randomEvent()).then((reply) => {
			assert.isNumber(reply, 'producer push events provide the current queue size');
			assert.equal(reply, 1, 'queue has only 1 event');
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