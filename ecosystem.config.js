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
		},
	],
};
