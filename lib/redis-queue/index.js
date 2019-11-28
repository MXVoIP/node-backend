const EventEmitter = require('events').EventEmitter;
const jss = require('json-stable-stringify');
const crypto = require('crypto');
const md5 = (data) => {return crypto.createHash('md5').update(data).digest('hex');};

const Counter = require('prom-client').Counter;
const Summary = require('prom-client').Summary;
const register = require('prom-client').register;

// the time to block on a queue before timing out
const defaultTimeout = 60;

// light wrapper around a Task
class Task {
	constructor(data, retry=false) {
		// handle when we get it back from redis - i.e. a consumer has grabbed it
		if (data.taskWrapper && data.taskWrapper.id) {
			this.taskWrapper = data.taskWrapper;
			if (retry) {
				this.taskWrapper.retries += 1;
				this._updateStatus(`retry: ${this.taskWrapper.retries}`);
			}
		}
		else // a newly received task
		{
			// deterministically stringify the data
			const fixedData = jss(data);
			this.taskWrapper = {
				taskId: md5(fixedData),
				createdAt: Date.now(),
				payload: fixedData,
				retries: 0,
				log: []
			};
			this._updateStatus('created');
		}
	}

	// stringify the task for pushing to redis
	toString() {
		return JSON.stringify(this.taskWrapper);
	}

	// private: update the status
	_updateStatus(status) {
		const lastStatus = this.taskWrapper.status;
		if (status == lastStatus) return;
		this.taskWrapper.status = status;
		this.taskWrapper.log.push({
			timestamp: Date.now(),
			action: 'status change',
			from: lastStatus || 'n/a',
			to: status
		});
	}
	// indicate when a consumer has started processing the task
	startProcessing() {
		this.start = Date.now();
		this.data = JSON.parse(this.taskWrapper.payload);
		this._updateStatus('start processing');
	}

	// indicate when a consumer has completed a task
	endProcessing(completed=true) {
		this.end = Date.now();
		this._updateStatus('end processing');
		this.taskWrapper.log.push({
			startProcessing: this.start,
			endProcessing: this.end,
			duration: this.end - this.start,
			completed: completed
		});
	}
}

// the queue wrapper
module.exports = class Queue extends EventEmitter {
	constructor(redisClient, queueName, maxSize=100){
		super();
		// sanity checks
		if (!redisClient) throw new Error('redis client required!');
		if (!redisClient.connected) throw new Error('redisclient is not connected!');

		this.client = redisClient;
		this.key = queueName;
		this.workKey = queueName+':active';

		this.errorCounter = new Counter({
			name: `queue_error_counter_${this.name}`,
			help: 'Queue Error Counter',
			labels: ['type']
		});

		this.errorCounter = new Counter({
			name: `queue_error_counter_${this.name}`,
			help: 'Queue Error Counter',
			labels: ['type']
		});

		this.producerSummary = new Summary({
			name: `queue_${this.name}`,
			help: 'queue summary',
			labelNames: ['method', 'queueSize', 'duration']
		});
	}

	// push event data to the queue
	push(data) {
		const start = Date.now();
		return new Promise((resolve, reject) => {
			// wrap the event data in a task
			const task = new Task(data);
			// push to the queue
			this.client.lpush(this.key, task.text, (error, reply) => {
				if (error) {
					this.summary.labels('push').observe(Date.now() - start);
					this.emit('error', error);
					return reject(error);
				}
				this.emit('push', reply);
				const length = parseInt(reply);
				if (isNaN(length) || length >= this.maxSize) {
					this.emit('queueSize');
					return reject(`Number of items in queue has exceeded ${this.maxSize}: ${length}`);
				}
				return resolve(reply);
			});
		});
	}

	// pop a task from the queue for processing
	pop(timeout=defaultTimeout) {
		return new Promise((resolve, reject) => {
			// use the reliable queue pattern from redis
			// this should really use redis streams but that is non-trivial
			this.client.brpoplpush(this.key, this.workKey, timeout, (error, reply) => {
				if (error) {
					this.emit('error', error);
					return reject(error);
				}
				// when the reply is nil/null it means the blocking request timed out
				if (!reply) {
					this.emit('timeout');
					return resolve(0);
				}
				// the response should be a task
				const task = new Task(JSON.parse(reply));
				this.emit('pop', task, timeout);
				return resolve(task);
			});
		});
	}

	// whena task is completed it must be ACKed to pop it from the active queue before the timeout
	// or the task will be placed back in the primary queue
	ack(task) {
		return new Promise((resolve, reject) => {
			this.client.lrem(this.key, 1, task.text, (error, reply) => {
				if (error) {
					this.emit('error', error);
					return reject(error);
				}
				this.emit('ack');
				return resolve(reply);
			});
		});
	}

	// monitor the active queue for timeouts
	// in theory the first item is the oldest item in the queue
	monitorTimeouts(timeout=1000*60) {
		const now = Date.now();
		return new Promise((resolve, reject) => {
			this.client.lindex(this.workKey, 0, (error, reply) => {
				if (error) {
					this.emit('error', error);
					return reject(error);
				}
				// if the active queue is empty we are good
				if (!reply) {
					return resolve();
				}
				const task = new Task(JSON.parse(reply));
				if (now - task.taskWrapper.createdAt >= timeout) {
					this.emit('taskTimeout', task);
					return reject(task);
				}
				return resolve();
			});
		});
	}
};
