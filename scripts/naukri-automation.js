const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Add stealth plugin to avoid detection
chromium.use(stealth);

// Log buffer to capture all logs
let logBuffer = [];

// Override console methods to capture logs
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const message = args.join(' ');
  logBuffer.push(message);
  originalLog(...args);
};

console.error = (...args) => {
  const message = '❌ ERROR: ' + args.join(' ');
  logBuffer.push(message);
  originalError(...args);
};

// Function to send logs to Telegram
async function sendLogsToTelegram(logs) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    originalLog('⚠️  Telegram credentials not found. Skipping log sending.');
    return;
  }

  // Escape special characters for Telegram MarkdownV2
  function escapeMarkdown(text) {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }

  // Format logs with timestamp
  const timestamp = new Date().toLocaleString();
  const escapedLogs = logs.map(log => escapeMarkdown(log)).join('\n');
  const formattedLogs = `🤖 *Naukri Automation Report*\n📅 ${escapeMarkdown(timestamp)}\n\n${escapedLogs}`;

  // Split message if it's too long (Telegram has 4096 character limit)
  const maxLength = 4000;
  const messages = [];
  
  if (formattedLogs.length <= maxLength) {
    messages.push(formattedLogs);
  } else {
    let currentMessage = `🤖 *Naukri Automation Report \\(Part 1\\)*\n📅 ${escapeMarkdown(timestamp)}\n\n`;
    let partNumber = 1;
    
    for (const log of logs) {
      const escapedLog = escapeMarkdown(log);
      if ((currentMessage + escapedLog + '\n').length > maxLength) {
        messages.push(currentMessage);
        partNumber++;
        currentMessage = `🤖 *Naukri Automation Report \\(Part ${partNumber}\\)*\n\n`;
      }
      currentMessage += escapedLog + '\n';
    }
    
    if (currentMessage.length > 0) {
      messages.push(currentMessage);
    }
  }

  // Send each message
  for (const message of messages) {
    const data = JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'MarkdownV2'
    });

    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => { responseData += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            originalLog('✓ Logs sent to Telegram successfully!');
            resolve();
          } else {
            originalError(`Failed to send logs to Telegram. Status: ${res.statusCode}`);
            originalError(`Response: ${responseData}`);
            resolve(); // Don't reject to avoid breaking the script
          }
        });
      });

      req.on('error', (error) => {
        originalError('Error sending logs to Telegram:', error.message);
        resolve(); // Don't reject to avoid breaking the script
      });

      req.write(data);
      req.end();
    });

    // Small delay between messages
    if (messages.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

(async () => {
  // Detect if running in CI environment
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  // Launch browser with proxy configuration
  const browser = await chromium.launch({ 
    headless: isCI, // Use headless mode in CI, headed mode locally
    slowMo: isCI ? 0 : 500, // No slowMo in CI for faster execution
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    proxy: {
      server: 'http://p.webshare.io:80',
      username: process.env.PROXY_USERNAME || 'nfcrqioq-rotate',
      password: process.env.PROXY_PASSWORD || 'ifs2qe30hpiv'
    }
  });
  
  // Create context with realistic fingerprint
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    permissions: ['geolocation'],
    geolocation: { latitude: 22.5726, longitude: 88.3639 }, // Kolkata coordinates
    extraHTTPHeaders: {
      'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  
  const page = await context.newPage();
  
  // Create screenshots directory if it doesn't exist
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // Verify proxy is working
    console.log('========================================');
    console.log('STEP 0: Verify Proxy Connection');
    console.log('========================================');
    try {
      console.log('Checking IP address through proxy...');
      await page.goto('https://api.ipify.org?format=json', { timeout: 15000 });
      const ipInfo = await page.textContent('body');
      console.log('✓ Proxy working! IP Info:', ipInfo);
    } catch (error) {
      console.log('⚠️  Could not verify proxy (non-critical):', error.message);
    }

    console.log('\n========================================');
    console.log('TASK 1: Login to Naukri.com');
    console.log('========================================');

    // Navigate to login page
    console.log('Navigating to login page...');
    await page.goto(process.env.NAUKRI_URL || 'https://www.naukri.com/nlogin/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Wait a bit for any dynamic content
    await page.waitForTimeout(3000);
    
    // Take screenshot for debugging
    const loginScreenshot = path.join(screenshotsDir, `login-page-${Date.now()}.png`);
    await page.screenshot({ path: loginScreenshot, fullPage: true });
    console.log(`✓ Screenshot saved: ${loginScreenshot}`);
    
    // Log page title and URL for debugging
    console.log('Current URL:', page.url());
    console.log('Page title:', await page.title());

    // Try multiple selectors for email field
    console.log('Entering email...');
    let emailFilled = false;
    const emailSelectors = [
      '#usernameField',
      'input[type="text"][placeholder*="Email"]',
      'input[type="text"][placeholder*="email"]',
      'input[name="email"]',
      'input[type="email"]',
      'input.input-text[type="text"]'
    ];
    
    for (const selector of emailSelectors) {
      try {
        console.log(`Trying selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: 10000, state: 'visible' });
        await page.fill(selector, process.env.USER_EMAIL, { timeout: 10000 });
        console.log(`✓ Email entered successfully with selector: ${selector}`);
        emailFilled = true;
        break;
      } catch (error) {
        console.log(`✗ Selector ${selector} failed: ${error.message}`);
        continue;
      }
    }
    
    if (!emailFilled) {
      // Save HTML for debugging
      const htmlContent = await page.content();
      const htmlFile = path.join(screenshotsDir, `login-page-${Date.now()}.html`);
      fs.writeFileSync(htmlFile, htmlContent);
      console.error(`❌ Could not find email field. HTML saved to: ${htmlFile}`);
      throw new Error('Email field not found with any known selector');
    }
    await page.waitForTimeout(500);

    // Fill password field with fallback selectors
    console.log('Entering password...');
    let passwordFilled = false;
    const passwordSelectors = [
      '#passwordField',
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="Password"]',
      'input[placeholder*="password"]'
    ];
    
    for (const selector of passwordSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
        await page.fill(selector, process.env.USER_PASSWORD, { timeout: 5000 });
        console.log(`✓ Password entered successfully with selector: ${selector}`);
        passwordFilled = true;
        break;
      } catch (error) {
        continue;
      }
    }
    
    if (!passwordFilled) {
      throw new Error('Password field not found with any known selector');
    }
    
    await page.waitForTimeout(500);

    // Click login button with fallback selectors
    console.log('Clicking login button...');
    const loginButtonSelectors = [
      'button[type="submit"].btn-large.btn-block.btn-bold.blue-btn',
      'button[type="submit"]',
      'button:has-text("Login")',
      'input[type="submit"]',
      '.btn-primary[type="submit"]'
    ];
    
    let loginClicked = false;
    for (const selector of loginButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
        await page.click(selector, { timeout: 5000 });
        console.log(`✓ Login button clicked with selector: ${selector}`);
        loginClicked = true;
        break;
      } catch (error) {
        continue;
      }
    }
    
    if (!loginClicked) {
      throw new Error('Login button not found with any known selector');
    }

    // Wait for successful login - check for homepage URL
    console.log('Waiting for successful login...');
    await page.waitForURL('**/mnjuser/homepage', { timeout: 30000 });
    
    // Verify "Complete profile" button is visible
    console.log('Verifying login success...');
    await page.locator('.view-profile-wrapper a[href="/mnjuser/profile"]').waitFor({ 
      state: 'visible',
      timeout: 15000 
    });
    console.log('✓ Login successful!');

    console.log('\n========================================');
    console.log('TASK 2: Update Career Preferences');
    console.log('========================================');

    // Click on "Complete profile" button
    console.log('Clicking Complete profile button...');
    await page.locator('.view-profile-wrapper a[href="/mnjuser/profile"]').click();
    await page.waitForTimeout(1000);

    // Wait for "Your career preferences" heading to be visible
    console.log('Waiting for career preferences section...');
    await page.locator('h1.section-heading:has-text("Your career preferences")').waitFor({ 
      state: 'visible',
      timeout: 15000 
    });

    // Click on the pencil icon next to "Your career preferences"
    console.log('Clicking pencil icon to edit career preferences...');
    await page.locator('h1.section-heading:has-text("Your career preferences") .new-pencil').click();
    await page.waitForTimeout(1000);

    // Wait for modal to appear
    console.log('Waiting for career preferences modal...');
    await page.locator('.styles_modal__gNwvD[role="dialog"]').waitFor({ 
      state: 'visible',
      timeout: 10000 
    });
    await page.locator('h1.title:has-text("Career preferences")').waitFor({ state: 'visible' });
    console.log('✓ Modal opened successfully!');

    // Check if Kolkata is already added
    console.log('Checking if Kolkata is already set...');
    const kolkataChip = await page.locator('.selectedChips .chip:has-text("Kolkata")').count();
    
    if (kolkataChip > 0) {
      console.log('Kolkata is already set. Removing it...');
      
      // Click on the X button to remove Kolkata
      await page.locator('.selectedChips .chip:has-text("Kolkata") .fn-chips-cross').click();
      await page.waitForTimeout(1000);
      
      // Verify Kolkata chip is removed
      console.log('Verifying Kolkata is removed...');
      await page.locator('.selectedChips .chip:has-text("Kolkata")').waitFor({ 
        state: 'hidden',
        timeout: 5000 
      });
      console.log('✓ Kolkata removed successfully!');
    } else {
      console.log('Kolkata is not set. Adding it...');
      
      // Click on the location input field to focus it
      console.log('Focusing on location input field...');
      await page.locator('#location').click();
      await page.waitForTimeout(500);

      // Type "Kolkata" slowly to mimic human behavior
      console.log('Typing "Kolkata" in location field...');
      await page.locator('#location').type('Kol', { delay: 150 });
      await page.waitForTimeout(300);
      await page.locator('#location').type('kata', { delay: 150 });
      await page.waitForTimeout(1000);

      // Wait for dropdown suggestions to appear
      console.log('Waiting for location suggestions...');
      await page.locator('.sugMenuWrapper').waitFor({ state: 'visible', timeout: 5000 });

      // Click on "Kolkata" from the suggestions
      console.log('Selecting Kolkata from suggestions...');
      await page.locator('.sugItemWrapper:has-text("Kolkata")').first().click();
      await page.waitForTimeout(1000);

      // Verify Kolkata chip is added
      console.log('Verifying Kolkata is added...');
      await page.locator('.selectedChips .chip:has-text("Kolkata")').waitFor({ 
        state: 'visible',
        timeout: 5000 
      });
      console.log('✓ Kolkata added successfully!');
    }

    // Click Save button
    console.log('Clicking Save button...');
    await page.locator('button#submit-btn.btn-blue:has-text("Save")').click();
    await page.waitForTimeout(1000);

    // Wait for modal to disappear
    console.log('Waiting for modal to close...');
    await page.locator('.styles_modal__gNwvD[role="dialog"]').waitFor({ 
      state: 'hidden',
      timeout: 10000 
    });
    console.log('✓ Career preferences updated successfully!');

    console.log('\n========================================');
    console.log('TASK 3: Logout from Application');
    console.log('========================================');

    // Click on user menu icon (hamburger menu with profile image)
    console.log('Opening user menu...');
    await page.locator('.nI-gNb-drawer__icon').click();
    await page.waitForTimeout(1000);

    // Click on logout button
    console.log('Clicking logout button...');
    await page.locator('a.nI-gNb-list-cta[title="Logout"]').click();
    await page.waitForTimeout(2000);

    // Verify logout by checking for login button on the page
    console.log('Verifying logout...');
    await page.locator('a#login_Layer.nI-gNb-lg-rg__login:has-text("Login")').waitFor({ 
      state: 'visible',
      timeout: 15000 
    });
    console.log('✓ Logout successful!');

    console.log('\n========================================');
    console.log('✓ All tasks completed successfully!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error occurred during automation:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    
    // Take screenshot on error
    try {
      const errorScreenshot = path.join(screenshotsDir, `error-${Date.now()}.png`);
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.error(`Error screenshot saved: ${errorScreenshot}`);
      
      // Save HTML on error
      const htmlContent = await page.content();
      const htmlFile = path.join(screenshotsDir, `error-${Date.now()}.html`);
      fs.writeFileSync(htmlFile, htmlContent);
      console.error(`Error HTML saved: ${htmlFile}`);
    } catch (screenshotError) {
      console.error('Could not save error screenshot:', screenshotError.message);
    }
  } finally {
    // Close browser
    console.log('\nClosing browser...');
    await page.waitForTimeout(2000);
    await browser.close();
    console.log('Browser closed.');
    
    // Send logs to Telegram
    console.log('\nSending logs to Telegram...');
    await sendLogsToTelegram(logBuffer);
    
    // Clear log buffer for next run
    logBuffer = [];
  }
})();
