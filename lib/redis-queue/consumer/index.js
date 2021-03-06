const EventEmitter = require('events').EventEmitter;
const Task = require('../task');

module.exports = class Consumer extends EventEmitter {
	constructor(queue, idleTimeout) {
		super();
		this.queue = queue;
		this.idleTimeout = idleTimeout;
	}

	// pop a task from the queue for processing
	pop() {
		return new Promise((resolve, reject) => {
			// use the reliable queue pattern from redis
			// this should really use redis streams but that is non-trivial
			this.queue.client.brpoplpush(this.queue.key, this.queue.workKey, this.idleTimeout, (error, reply) => {
				if (error) {
					this.emit('redisError', error);
					return reject(error);
				}
				// when the reply is nil/null it means the blocking request timed out
				// may decide to pause or stop the queue
				if (!reply) {
					this.emit('idleTimeout', this.idleTimeout);
					return resolve(0);
				}
				// the response should be a task
				const task = new Task(JSON.parse(reply));
				// need the original string for "ack"
				task.lref = reply;
				this.emit('pop', task);
				return resolve(task);
			});
		});
	}

	// when a task is completed it must be ACKed by the consumer to remove it from the 
	// active queue before the SLA timeout or the task will be placed back in the primary queue
	ack(task) {
		return new Promise((resolve, reject) => {
			this.queue.client.lrem(this.queue.workKey, 1, task.lref, (error, reply) => {
				if (error) {
					this.emit('redisError', error);
					return reject(error);
				}
				this.emit('ack', reply);
				return resolve(reply);
			});
		});
	}
};