# Naukri.com Automation Script

[![Run Automation](https://img.shields.io/badge/▶️_Run_Automation-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/imshaiknasir/automate-it-to-get-it/actions/workflows/naukri-automation.yml)

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

# Optional: Telegram notifications
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### GitHub Actions Secrets

For automated runs via GitHub Actions, configure these secrets in your repository:
- `USER_EMAIL` - Your Naukri.com email (required)
- `USER_PASSWORD` - Your Naukri.com password (required)
- `NAUKRI_URL` - Login URL (optional, defaults to Naukri login page)
- `TELEGRAM_BOT_TOKEN` - For notifications (optional)
- `TELEGRAM_CHAT_ID` - For notifications (optional)

## Usage

### Run Locally
```bash
npm run automate
```

### Run via GitHub Actions (One-Click)
Click the **"Run Automation"** badge at the top of this README, or:
1. Go to the [Actions tab](https://github.com/imshaiknasir/automate-it-to-get-it/actions/workflows/naukri-automation.yml)
2. Click "Run workflow" button
3. Optionally add a reason and click "Run workflow"

The script will:
- Open a browser window (headed mode locally, headless in CI)
- Execute all three tasks sequentially
- Provide console output for each step
- Close the browser automatically when done
- Upload screenshots and videos as artifacts (CI only)

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
