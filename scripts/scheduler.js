const path = require('node:path');
const { spawn } = require('node:child_process');
const schedule = require('pm2-schedule');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'naukri-automation.js');

function runAutomation() {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] Triggering naukri-automation.js`);

	const child = spawn('node', [SCRIPT_PATH], {
		cwd: ROOT_DIR,
		env: process.env,
		stdio: 'inherit',
	});

	child.on('close', (code) => {
		console.log(`[${new Date().toISOString()}] naukri-automation.js exited with code ${code}`);
	});

	child.on('error', (error) => {
		console.error('Failed to start naukri-automation.js', error);
	});
}

// Schedules use server timezone. Recommend setting server timezone to Asia/Kolkata (IST)
// to keep the intended 08:30 and 11:30 IST triggers simple and accurate.
schedule.scheduleJob('0 30 8 * * 1-5', runAutomation);
schedule.scheduleJob('0 30 11 * * 1-5', runAutomation);

console.log('Scheduler booted. Jobs set for 08:30 and 11:30 IST, Monday to Friday.');
