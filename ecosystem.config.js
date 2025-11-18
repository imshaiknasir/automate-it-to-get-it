const path = require('path');

module.exports = {
	apps: [
		{
			name: 'scheduler',
			script: 'scripts/scheduler.js',
			cwd: __dirname,
			env: {
				NODE_ENV: 'production',
			},
			autorestart: true,
			restart_delay: 5000,
			max_restarts: 10,
			// Restart if memory usage exceeds 500MB
			max_memory_restart: '500M',
			// Custom log configuration
			out_file: path.join(__dirname, 'logs', 'pm2-out.log'),
			error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
			log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
			merge_logs: true,
			// Log type (can be 'json' for structured logging)
			log_type: 'json',
		},
	],
};
