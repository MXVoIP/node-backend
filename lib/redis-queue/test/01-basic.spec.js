// make sure to setup a .env file in the root of this library for tests
require('dotenv').config();
const randomBytes = require('crypto').randomBytes;
const test = require('tape');
const Queue = require('../queue');
const Producer = require('../producer');
const Consumer = require('../consumer');

const client = require('redis').createClient({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT,
	prefix: process.env.REDIS_PREFIX,
	enable_offline_queue: false
});

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

// don't start until redis is connected
client.on('ready', () => {
	const queue = new Queue(client, 'test:testqueue', 5);
	const producer = new Producer(queue);
	const consumer = new Consumer(queue, 60);
	let testEvent, testTask;

	//////////////////////////////
	// Queue events
	//////////////////////////////
	queue.on('statusChange', (oldStatus, newStatus) => {
		test('Handle Queue status change', (assert) => {
			assert.true(Queue.statusEnum.includes(newStatus), `status changed to ${newStatus}`);
			assert.end();
		});
	});

	queue.on('error', (error) => {
		test('Handle Queue error event', (assert) => {
			assert.true(error instanceof Error, 'error is of type "Error"');
			assert.end();
		});
	});

	queue.on('redisError', (error) => {
		test('Handle redis client error event', (assert) => {
			assert.true(error instanceof Error, 'error is of type "Error"');
			assert.end();
		});
	});

	queue.on('redisEnd', () => {
		test('Handle redis client end event', (assert) => {
			assert.equal(queue.status, 'stopped', 'queue is no longer listening');
			assert.end();
		});
	});

	//////////////////////////////
	// Producer events
	//////////////////////////////
	
	producer.on('error', (error) => {
		test('Handle Producer error event', (assert) => {
			assert.true(error instanceof Error, 'error is of type "Error"');
			assert.end();
		});
	});

	producer.on('redisError', (error) => {
		test('Handle redis error event in Producer', (assert) => {
			assert.true(error instanceof Error, 'error is of type "Error"');
			assert.end();
		});
	});
	
	producer.on('push', (length, duration) => {
		test('Handle Producer push event', (assert) => {
			assert.true(!isNaN(length), 'queue length is a number');
			assert.true(!isNaN(duration), 'duration is a number');
			assert.end();
		});
	});

	//////////////////////////////
	// Consumer events
	//////////////////////////////
	
	producer.on('error', (error) => {
		test('Handle Producer error event', (assert) => {
			assert.true(error instanceof Error, 'error is of type "Error"');
			assert.end();
		});
	});

	producer.on('redisError', (error) => {
		test('Handle redis error event in Producer', (assert) => {
			assert.true(error instanceof Error, 'error is of type "Error"');
			assert.end();
		});
	});
	
	producer.on('push', (length, duration) => {
		test('Handle Producer push event', (assert) => {
			assert.true(!isNaN(length), 'queue length is a number');
			assert.true(!isNaN(duration), 'duration is a number');
			assert.end();
		});
	});

	//////////////////////////////
	// Produce an event
	//////////////////////////////
	testEvent = randomEvent();
	test('Produce a new event', (assert) => {
		producer.push(testEvent).then((queueSize) => {
			assert.isEqual(queueSize, 1, 'queue size should equal 1');
			assert.end();
		}).catch((error) => {
			assert.end(error);
		});
	});

	//////////////////////////////
	// Event should be in pending
	//////////////////////////////
	test('Queue should have 1 pending event', (assert) => {
		queue.getPending()
			.then((eventsPending) => {
				assert.isEqual(eventsPending, 1, 'there should be 1 pending event');
				assert.end();
			})
			.catch((error) => {
				assert.end(error);
			});
	});

	//////////////////////////////
	// Consume an event
	//////////////////////////////
	test('Consume a new event', (assert) => {
		consumer.pop().then((task) => {
			testTask = task;
			testTask.startProcessing();
			testTask.endProcessing();
			assert.deepEqual(testTask.data, testEvent, 'consumed event should equal the event from the producer');
			assert.end();
		}).catch((error) => {
			assert.end(error);
		});
	});

	//////////////////////////////
	// Event should no longer be in pending
	//////////////////////////////
	test('Queue should have 0 pending events', (assert) => {
		queue.getPending().then((eventsPending) => {
			assert.isEqual(eventsPending, 0, 'there should be 0 pending events');
			assert.end();
		}).catch((error) => {
			assert.end(error);
		});
	});

	//////////////////////////////
	// Event should be in process queue
	//////////////////////////////
	test('Queue should have 1 processing event', (assert) => {
		queue.getProcessing().then((eventsProcessing) => {
			assert.isEqual(eventsProcessing, 1, 'there should be 1 pprocessing event');
			assert.end();
		}).catch((error) => {
			assert.end(error);
		});
	});

	//////////////////////////////
	// Acknowledge an event
	//////////////////////////////
	test('Acknowledge a completed event', (assert) => {
		consumer.ack(testTask).then((numAcked) => {
			assert.equal(numAcked, 1, 'task was successfully ACKed');
			assert.end();
		}).catch((error) => {
			assert.end(error);
		});
	});

	//////////////////////////////
	// Event should no longer be in pending
	//////////////////////////////
	test('Queue should have 0 pending events', (assert) => {
		queue.getPending().then((eventsPending) => {
			assert.isEqual(eventsPending, 0, 'there should be 0 pending events');
			assert.end();
		}).catch((error) => {
			assert.end(error);
		});
	});

	//////////////////////////////
	// Event should no longer be in process queue
	//////////////////////////////
	test('Queue should have 0 processing events', (assert) => {
		queue.getProcessing().then((eventsProcessing) => {
			assert.isEqual(eventsProcessing, 0, 'there should be 0 pprocessing events');
			assert.end();
		}).catch((error) => {
			assert.end(error);
		});
	});

	//////////////////////////////
	// Queue should stop listening gracefully
	//////////////////////////////
	test('Queue should stop listening gracefully', (assert) => {
		queue.on('redisEnd', () => {
			assert.equal(queue.status, 'stopped');
			assert.end();
		});
		queue.stop();

	});

});
