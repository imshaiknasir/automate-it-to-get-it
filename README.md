# Naukri.com Automation Script

[![Run Automation](https://img.shields.io/badge/▶️_Run_Automation-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/imshaiknasir/automate-it-to-get-it/actions/workflows/naukri-automation.yml)

This is a Playwright-based automation script (NOT a test) that automates interactions with Naukri.com.

## Features

The script performs the following tasks:

1. **Login**: Logs into Naukri.com with provided credentials
2. **Update Career Preferences**: Navigates to profile and adds "Kolkata" as a preferred work location
3. **Random CV Upload**: Randomly selects and uploads one CV from multiple stored resumes (optional)
4. **Logout**: Logs out from the application

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

### CV Upload Setup (Optional)

To enable automatic CV uploads with random selection:

1. **Prepare your resume files** using the encoding script:
```bash
node scripts/prepare-cv.js ~/Documents/resume-v1.pdf
node scripts/prepare-cv.js ~/Documents/resume-v2.pdf
node scripts/prepare-cv.js ~/Documents/resume-v3.pdf
```

2. **Copy the base64 output** from each command

3. **Add to GitHub Secrets** (see instructions below)

**Important Security Notes:**
- ✅ CV files are stored as base64-encoded GitHub Secrets (encrypted and secure)
- ✅ Never commit actual CV/resume files to the repository
- ✅ Fork-safe: Others won't see your CVs when they fork your repo
- ✅ Each run randomly selects one CV from available options
- ⚠️ GitHub Secrets have a 64KB limit (~48KB PDF after base64 encoding)
- 💡 Supported formats: PDF, DOC, DOCX, RTF (up to 2MB for Naukri.com)

### GitHub Actions Secrets

For automated runs via GitHub Actions, configure these secrets in your repository:

**Required Secrets:**
- `USER_EMAIL` - Your Naukri.com email
- `USER_PASSWORD` - Your Naukri.com password

**Optional Secrets:**
- `TELEGRAM_BOT_TOKEN` - For notifications
- `TELEGRAM_CHAT_ID` - For notifications

**CV Upload Secrets (Optional - for automatic resume updates):**
- `CV_FILE_1_BASE64` - Base64-encoded resume file #1
- `CV_FILE_1_EXT` - File extension (e.g., `pdf`, `docx`)
- `CV_FILE_2_BASE64` - Base64-encoded resume file #2
- `CV_FILE_2_EXT` - File extension
- `CV_FILE_3_BASE64` - Base64-encoded resume file #3
- `CV_FILE_3_EXT` - File extension
- *(Continue pattern for up to 10 CVs if needed)*

**How to add secrets:**
1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add each secret name and value
5. Click **"Add secret"**

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
- Execute all tasks sequentially
- Upload a randomly selected CV (if configured)
- Provide console output for each step
- Close the browser automatically when done
- Upload screenshots and videos as artifacts (CI only)

## Configuration

Edit `playwright.config.js` to customize:
- `headless`: Set to `true` for headless execution
- `slowMo`: Adjust delay between actions (in milliseconds)
- `timeout`: Adjust default timeout for actions

## Security & Privacy

### CV File Security
- **No CVs in Repository**: Actual resume files are NEVER committed to git
- **Base64 Encoding**: CVs are encoded and stored as GitHub Secrets (encrypted)
- **Fork Safety**: When someone forks your repo, they don't get your CVs
- **Temporary Files**: Decoded CVs are stored temporarily during execution and deleted immediately after
- **No Artifacts**: CV files are excluded from GitHub Actions artifacts

### How It Works
1. You encode your CV locally using `scripts/prepare-cv.js`
2. You manually add the base64 string to GitHub Secrets
3. During workflow execution, secrets are decoded to temporary files
4. Script randomly selects one CV and uploads it
5. Temporary files are deleted immediately after upload
6. Base64 secrets remain encrypted in GitHub's secure storage

## Notes

- The script uses Playwright's browser automation (not @playwright/test)
- All actions include appropriate waits and error handling
- The script runs in headed mode by default to visualize the automation
- Human-like typing delays are implemented for the location input field
- CV upload is optional and gracefully skips if no CV secrets are configured
- Random CV selection helps avoid detection patterns

## Troubleshooting

### CV Upload Issues

**"No CV files found in environment variables"**
- Add at least one `CV_FILE_1_BASE64` secret to GitHub Secrets
- Ensure you also added the corresponding `CV_FILE_1_EXT` secret

**"File exceeds GitHub Secret limit"**
- Your PDF is too large (>48KB after base64 encoding)
- Compress your PDF using online tools or Adobe Acrobat
- Remove high-resolution images or unnecessary pages

**"CV upload failed"**
- Check the uploaded screenshot artifact for visual debugging
- Naukri.com may have changed their UI (update selectors in script)
- File format may not be supported (use PDF for best compatibility)
