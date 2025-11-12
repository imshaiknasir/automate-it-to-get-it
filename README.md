# Naukri.com Automation Script

This is a Playwright-based automation script (NOT a test) that automates interactions with Naukri.com.

## Features

The script performs the following tasks:

1. **Login**: Logs into Naukri.com with provided credentials
2. **Update Career Preferences**: Navigates to profile and adds "Kolkata" as a preferred work location
3. **Logout**: Logs out from the application

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your credentials in `.env` file:
```env
USER_EMAIL=your_email@example.com
USER_PASSWORD=your_password
NAUKRI_URL=https://www.naukri.com/nlogin/login

# Proxy Configuration (Optional)
PROXY_LIST_URL=https://proxy.webshare.io/api/v2/proxy/list/download/YOUR_TOKEN/-/any/username/direct/-/?plan_id=YOUR_PLAN_ID
```

### Proxy Configuration

The script supports two proxy methods:

**Method 1: Dynamic Proxy List (Recommended)**
- Set `PROXY_LIST_URL` with your WebShare.io download link
- The script will:
  - Download the full proxy list on first run
  - Cache it locally for 24 hours (`.proxy-cache.json`)
  - Randomly select one proxy per session for consistency
  - Refresh cache after 24 hours

**Method 2: Static Proxy (Fallback)**
- Set `PROXY_SERVER=http://IP:PORT` for a single proxy
- Used only if `PROXY_LIST_URL` is not configured

**Benefits of Method 1:**
- ✅ No authentication overhead (direct connection)
- ✅ Random proxy selection per run
- ✅ Session consistency (same IP throughout one run)
- ✅ Automatic cache management
- ✅ Better reliability with multiple proxies

## Usage

Run the automation script:
```bash
npm run automate
```

The script will:
- Open a browser window (headed mode)
- Execute all three tasks sequentially
- Provide console output for each step
- Close the browser automatically when done

## Configuration

Edit `playwright.config.js` to customize:
- `headless`: Set to `true` for headless execution
- `slowMo`: Adjust delay between actions (in milliseconds)
- `timeout`: Adjust default timeout for actions

## Notes

- The script uses Playwright's browser automation (not @playwright/test)
- All actions include appropriate waits and error handling
- The script runs in headed mode by default to visualize the automation
- Human-like typing delays are implemented for the location input field
