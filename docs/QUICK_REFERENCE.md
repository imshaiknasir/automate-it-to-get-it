# Quick Reference: Logging & Video Management

## Daily Operations

### Check Today's Activity
```bash
# Did automation run today?
cat logs/execution-$(date +%Y-%m-%d).log

# View all activity today
cat logs/combined-$(date +%Y-%m-%d).log

# View errors only
cat logs/error-$(date +%Y-%m-%d).log
```

### PM2 Operations
```bash
# View live logs
pm2 logs scheduler

# Check status
pm2 list
pm2 show scheduler

# Restart after changes
pm2 restart scheduler

# View last 50 lines
pm2 logs scheduler --lines 50
```

### Video Management
```bash
# List all videos
ls -lh videos/

# Count videos
ls videos/*.webm | wc -l

# Check videos directory size
du -sh videos/

# Manual cleanup (delete videos older than 7 days)
node scripts/utils/cleanup-videos.js
```

---

## Configuration

### Environment Variables (.env)
```bash
# Log retention (days)
LOG_RETENTION_DAYS=14

# Video retention (days)  
VIDEO_RETENTION_DAYS=7

# Optional: Set log level for debugging
LOG_LEVEL=debug
```

---

## Schedules

### Automation Runs
- **08:30 IST** - Monday to Friday
- **11:30 IST** - Monday to Friday

### Cleanup Jobs
- **02:00 IST** - Every Monday (video cleanup)

---

## Log Files

### Application Logs (logs/)
- `combined-YYYY-MM-DD.log` - All logs (info, warn, error)
- `error-YYYY-MM-DD.log` - Errors only
- `execution-YYYY-MM-DD.log` - Execution summaries
- `exceptions-YYYY-MM-DD.log` - Uncaught exceptions
- `rejections-YYYY-MM-DD.log` - Unhandled promises

### PM2 Logs (logs/)
- `pm2-out.log` - PM2 stdout (JSON format)
- `pm2-error.log` - PM2 stderr

---

## Troubleshooting

### No logs generated?
```bash
# Check logs directory
ls -la logs/

# Check environment
node -e "require('dotenv').config(); console.log(process.env.LOG_RETENTION_DAYS)"

# Run directly to see output
node scripts/naukri-automation.js
```

### Videos not recording?
```bash
# Check videos directory
ls -la videos/

# Verify Playwright
npx playwright --version

# Check recent execution logs for video paths
cat logs/combined-$(date +%Y-%m-%d).log | grep "Video recording"
```

### PM2 not starting?
```bash
# Check PM2 status
pm2 status

# Restart PM2
pm2 restart all

# Check PM2 logs
pm2 logs --err
```

---

## Log Analysis

### Success Rate
```bash
# Count successes vs failures
cat logs/execution-*.log | jq -r '.success' | sort | uniq -c
```

### Recent Errors
```bash
# Last 5 errors
tail -n 5 logs/error-$(date +%Y-%m-%d).log | jq '.'
```

### Execution Duration
```bash
# Average duration
cat logs/execution-*.log | jq '.durationMs' | awk '{sum+=$1; count++} END {print "Avg:", sum/count/1000, "seconds"}'
```

### Find Specific Execution
```bash
# Search by execution ID
grep "exec-1731929400000-abc123" logs/combined-*.log
```

---

## PM2 Logrotate (Optional)

### Install
```bash
pm2 install pm2-logrotate
```

### Configure
```bash
# Max log size before rotation
pm2 set pm2-logrotate:max_size 10M

# Number of rotated files to keep
pm2 set pm2-logrotate:retain 30

# Enable compression
pm2 set pm2-logrotate:compress true

# Daily rotation at midnight
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

### Verify
```bash
pm2 conf pm2-logrotate
```

---

## Storage Management

### Check Disk Usage
```bash
# Logs size
du -sh logs/

# Videos size  
du -sh videos/

# Total project size
du -sh .
```

### Manual Cleanup
```bash
# Delete old logs (older than 30 days)
find logs/ -name "*.log" -type f -mtime +30 -delete

# Delete old videos (older than 7 days)
find videos/ -name "*.webm" -type f -mtime +7 -delete
```

---

## Quick Checks on VPS

### Is automation running?
```bash
pm2 list | grep scheduler
```

### Did it run today?
```bash
ls logs/execution-$(date +%Y-%m-%d).log && echo "Yes" || echo "No"
```

### Any errors today?
```bash
cat logs/error-$(date +%Y-%m-%d).log 2>/dev/null | wc -l
```

### Last execution status?
```bash
tail -n 1 logs/execution-$(date +%Y-%m-%d).log | jq '{success, duration, timestamp}'
```

---

## Full Documentation

For complete setup and configuration details, see:
- **[docs/LOGGING_SETUP.md](LOGGING_SETUP.md)** - Complete logging guide
- **[README.md](../README.md)** - Main project documentation
