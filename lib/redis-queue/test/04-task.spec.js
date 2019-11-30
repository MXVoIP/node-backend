const randomBytes = require('crypto').randomBytes;
const assert = require('chai').assert;
const Task = require('../task');

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

describe('Task unit tests', () => {
	it('should create a new task', (done) => {
		const task = new Task(randomEvent());
		assert.ok(task.taskWrapper, 'task was created successfully');
		done();
	});

	it('should be able to receive a previous task', (done) => {
		const task = new Task(randomEvent());
		assert.ok(task.taskWrapper, 'task was created successfully');
		const receivedTask = new Task(JSON.parse(task.toString()));
		assert.equal(receivedTask.taskId, task.taskId, 'received task has same task id');
		done();
	});

	it('should be able to retry a task', (done) => {
		const task = new Task(randomEvent());
		assert.ok(task.taskWrapper, 'task was created successfully');
		// delay a bit so the timestamps differ
		setTimeout(() => {
			const retryTask = new Task(JSON.parse(task.toString()), true);
			assert.equal(retryTask.taskId, task.taskId, 'retried task has same task id');
			assert.notEqual(retryTask.taskWrapper.startAt, task.taskWrapper.startAt, 'retried task has different startAt timestamp');
			done();
		}, 10);
	});

	it('should emit the startProcessing event when processing is started', (done) => {
		const task = new Task(randomEvent());
		task.on('startProcessing', () => {
			assert.ok(task.data, 'payload was parsed');
			done();
		});
		task.startProcessing();
	});

	it('should emit the endProcessing event when processing is finished', (done) => {
		const task = new Task(randomEvent());
		task.on('endProcessing', () => {
			assert.ok(task.data, 'payload was parsed');
			done();
		});
		task.startProcessing();
		task.endProcessing();
	});

	it('should allow handling of status changes', (done) => {
		const task = new Task(randomEvent());
		const statuses = ['test1', 'test2', 'test3', 'same', 'same'];
		task.on('taskStatus', (lastStatus, newStatus) => {
			assert.notEqual(lastStatus, newStatus, 'only changes to status should be emitted');
			if ('finished' == newStatus) done();
		});
		task.startProcessing();
		for (const status of statuses) {
			task.updateStatus(status);
		}
		task.endProcessing(true);
	});
});