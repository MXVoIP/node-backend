const EventEmitter = require('events').EventEmitter;
const enumStatus = ['stopped','stopping','running','paused'];

// the queue wrapper
module.exports = class Queue extends EventEmitter {
	constructor(redisClient, queueName, maxSize){
		super();
		// sanity checks
		if (!redisClient) throw new Error('redis client required!');
		if (!redisClient.connected) throw new Error('redisclient is not connected!');
		if (!queueName) throw new Error('the queue needs a name!');
		if (isNaN(maxSize) || maxSize <= 0) throw new Error('a max queue size must be specified');

		this.client = redisClient;
		
		// handle redis errors and connectivity events
		this.client.on('error', this.onRedisError.bind(this));
		this.client.on('end', this.onRedisClose.bind(this));
		// the basics of the queue
		this.key = queueName;
		this.workKey = queueName+':active';
		this.maxSize = maxSize;
		this.status = 'running';
		this._paused = 0;
		this._disconnects = 0;
	}

	// get the current status
	get status() {
		return this._status;
	}

	// wrapper around status changes
	set status(newStatus) {
		if (!enumStatus.includes(newStatus)) {
			throw new Error('attempt to set unknown status');
		}
		if (newStatus != this._status) {
			const lastStatus = this._status;
			this._status = newStatus;
			this.emit('statusChange', lastStatus, newStatus);
		}
		return this._status;
	}

	get isRunning() {
		if (this.client.connected && this.status == 'running') return true;
		return false;
	}

	get isPaused() {
		if (this.client.connected && this.status == 'paused') return true;
		return false;
	}

	// gracefully stop the producer and disconnect from redis
	stop(cb) {
		if (this.isPaused || this.isRunning) {
			this.client.quit(cb);
			this.status = 'stopping';
		}
		else {
			throw new Error('connection is already closing');
		}
	}

	// pause the queue temporarily
	// for example, if the queue is growing too rapidly
	// or the client is trying to reconnect
	pause() {
		// can only pause a running setup
		if (this.isRunning) {
			this.status = 'paused';
		}
	}

	// resume the queue after being paused
	resume() {
		if (!this.isRunning) {
			this.status = 'running';
		}

		return this.isRunning;
	}

	getPending() {
		return new Promise((resolve, reject) => {
			this.client.llen(this.key, (error, reply) => {
				if (error) {
					this.emit('error', error);
					return reject(error);
				}
				return resolve(reply);
			});
		});
	}

	getProcessing() {
		return new Promise((resolve, reject) => {
			this.client.llen(this.workKey, (error, reply) => {
				if (error) {
					this.emit('error', error);
					return reject(error);
				}
				return resolve(reply);
			});
		});
	}

	onRedisError(error) {
		this.emit('redisError', error);
	}

	onRedisClose()
	{
		this._disconnects += 1;
		this.status = 'stopped';
		this.emit('redisEnd');
	}
};