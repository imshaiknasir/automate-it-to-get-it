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
```
USER_EMAIL=your_email@example.com
USER_PASSWORD=your_password
NAUKRI_URL=https://www.naukri.com/nlogin/login
```

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
