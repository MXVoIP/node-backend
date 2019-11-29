const EventEmitter = require('events').EventEmitter;
const randomBytes = require('crypto').randomBytes;

function genId(){return randomBytes(16).toString('hex');}

// light wrapper around a Task
module.exports = class Task extends EventEmitter {
	constructor(data, retry=false) {
		super();
		// cache the current timestamp
		const now = Date.now();
		// handle when we get a task back from redis - i.e. a consumer has grabbed it
		if (data.taskId && data.createdAt && data.payload) {
			this.taskWrapper = data;
			if (retry) {
				this.taskWrapper.startAt = now;
				this.taskWrapper.retries += 1;
				this._updateStatus(`retry: ${this.taskWrapper.retries}`);
			}
		}
		else // a newly received task
		{
			this.taskWrapper = {
				taskId: genId(),
				createdAt: now,
				startAt: now,
				payload: JSON.stringify(data),
				retries: 0,
				log: [],
				status: 'n/a'
			};
			this._updateStatus('created');
		}
	}

	// stringify the task for pushing to redis
	toString() {
		return JSON.stringify(this.taskWrapper);
	}

	// private: update the status
	_updateStatus(newStatus) {
		const lastStatus = this.taskWrapper.status;
		if (newStatus == lastStatus) return;
		this.taskWrapper.status = newStatus;
		this.taskWrapper.log.push({
			timestamp: Date.now(),
			action: 'status change',
			from: lastStatus,
			to: newStatus
		});
		this.emit('taskStatus', lastStatus, newStatus);
	}

	// indicate when a consumer has started processing the task
	startProcessing() {
		// parse the actual event data
		this.data = JSON.parse(this.taskWrapper.payload);
		this._updateStatus('start processing');
		this.emit('startProcessing');
	}

	// indicate when a consumer has completed a task
	endProcessing(completionStatus=true) {
		const end = Date.now();
		this._updateStatus('end processing');
		this.taskWrapper.log.push({
			startProcessing: this.taskWrapper.startAt,
			endProcessing: end,
			duration: {current: end - this.start, cumulative: end - this.taskWrapper.createdAt},
			completedStatus: completionStatus
		});
		this.emit('endProcessing', completionStatus);
	}
};
