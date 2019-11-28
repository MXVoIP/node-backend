const EventEmitter = require('events').EventEmitter;
const Task = require('../task');

module.exports = class Producer extends EventEmitter {
	constructor(queue) {
		super();
		this.queueu = queue;
	}

	// push event data to the queue
	push(data) {
		const start = Date.now();
		return new Promise((resolve, reject) => {
			// make sure we can push events
			if (!this.queue.isRunning) {
				return reject(new Error('Cannot push events while not in a running state'));
			}
			// wrap the event data in a task
			const task = new Task(data);
			// push to the queue
			this.queue.client.lpush(this.queue.key, task.toString(), (error, reply) => {
				if (error) {
					this.emit('redisError', error);
					return reject(error);
				}
				// we pushed an item and the queue is too big
				// this doesn't keep us from going over the limit
				// but it should help us both notify of some pressure
				// as well as slow down the bleeding
				const length = parseInt(reply);
				if (isNaN(length) || length >= this.queue.maxSize) {
					this.queue.pause();
					this.emit('error',
						new Error(`Number of items in queue has exceeded ${this.queue.maxSize}: ${length}.`)
					);
				}
				// the length (the queue size) and duration in the push event should help
				// performance monitoring
				this.emit('push', length, (Date.now() - start));
				return resolve(reply);
			});
		});
	}
};