const EventEmitter = require('events').EventEmitter;
const enumStatus = ['stopped','stopping','running','paused'];
// backoff in seconds
const pauseBackoff = [5, 15, 30, 60, 120];
function backoff(index) {
	// multiply by 1000 to convert to milliseconds passed to setTimeout
	return pauseBackoff[index]*1000;
}

// the queue wrapper
module.exports = class Queue extends EventEmitter {
	constructor(redisClient, queueName, maxSize=100){
		super();
		// sanity checks
		if (!redisClient) throw new Error('redis client required!');
		if (!redisClient.connected) throw new Error('redisclient is not connected!');

		this.client = redisClient;
		
		// handle redis errors and connectivity events
		this.client.on('error', this.onRedisError.bind(this));
		this.client.on('end', this.onRedisClose.bind(this));
		this.client.on('reconnecting', this.onRedisReconnecting.bind(this));
		this.client.on('connect', this.onRedisConnect.bind(this));
		// the basics of the queue
		this.key = queueName;
		this.workKey = queueName+':active';
		this.maxSize = maxSize;
		this.status = 'running';
		this._paused = 0;
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
		if (newStatus == this.status) return;
		const lastStatus = this._status;
		this._status = newStatus;
		this.emit('statusChange', lastStatus, newStatus);
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
	stop(errMessage) {
		if (this.isPaused || this.isRunning) {
			this.queue.client.quit();
		}
		this.status = 'stopping';
		if (errMessage) {
			this.emit('error', new Error(errMessage));
		}
	}

	// pause the queue temporarily
	// for example, if the queue is growing too rapidly
	// or the client is trying to reconnect
	pause() {
		// can only pause a running setup
		if (this._isRunning) {
			this.status = 'paused';
			this._paused += 1;
			if (this._paused >= pauseBackoff.length()) {
				// we backed off enough times, now we shut it down
				this.stop('Pause Backoff exceeded.');
				return;
			}
			// try to resume after a backoff period
			setTimeout(this.resume.bind(this), backoff(this._paused));
		}
	}

	// resume the queue after being paused
	resume() {
		if (this._isPaused) {
			this.status = 'running';
			// wait a few seconds to see if we are stable
			// after a pause resumes to see
			setTimeout(() => {
				// if we are paused when this timeout happens, don't decrement
				if (!this.isRunning) return;
				// decrement the pause count
				this._paused = Math.max(0, this._paused - 1);
			}, backoff(this._paused));
		}
	}

	onRedisError(error) {
		this.emit('error', error);
	}

	onRedisClose() {
		this.stop();
	}

	onRedisReconnecting() {
		this.pause();
		this.emit('reconnecting');
	}

	onRedisConnect() {
		this.resume();
	}
};