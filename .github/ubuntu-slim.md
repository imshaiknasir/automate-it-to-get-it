GitHub Actions 1 vCPU Linux runners are now in public preview. Customers looking to run lightweight operations can take advantage of these lower cost runners. These runners are optimized for automation tasks, issue operations, and short running jobs outside of typical heavyweight CI/CD builds.

Runner details
These runners have one vCPU and 5 GBs RAM. When using these runners, your actions workflows execute inside of a container rather than a dedicated VM instance, enabling cost-effective, performant execution of automation tasks across GitHub. Each container provides hypervisor level 2 isolation, and the container is automatically decomissioned when a job is completed.

Jobs that use this runner type are limited to 15 minutes of execution time. Jobs exceeding this limit will be terminated and fail.

Good use cases for these runners include jobs like:

Auto-labelling issues
Basic language compilation (e.g., webpack builds)
Linting and formatting
Get started today
To get started, simply target the new runner type ubuntu-slim in any new or existing job definitions.

