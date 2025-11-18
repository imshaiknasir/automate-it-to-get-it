const path = require('node:path');
const { spawn } = require('node:child_process');
const cron = require('node-cron');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'naukri-automation.js');

function runAutomation() {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] Triggering naukri-automation.js`);

	// Wrap the automation script in xvfb-run so Chromium gets a virtual display
	const child = spawn('xvfb-run', ['-a', 'node', SCRIPT_PATH], {
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

// Explicit timezone ensures triggers fire in IST even if server uses another tz
const IST = 'Asia/Kolkata';

cron.schedule('0 30 8 * * 1-5', runAutomation, { timezone: IST });
cron.schedule('0 30 11 * * 1-5', runAutomation, { timezone: IST });

console.log('Scheduler booted. Jobs set for 08:30 and 11:30 IST, Monday to Friday.');
