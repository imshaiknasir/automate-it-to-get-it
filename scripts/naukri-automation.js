const { chromium } = require('@playwright/test');
const https = require('https');
require('dotenv').config();

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
    proxy: {
      server: 'http://p.webshare.io:80',
      username: process.env.PROXY_USERNAME || 'nfcrqioq-rotate',
      password: process.env.PROXY_PASSWORD || 'ifs2qe30hpiv'
    }
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('========================================');
    console.log('TASK 1: Login to Naukri.com');
    console.log('========================================');

    // Navigate to login page
    console.log('Navigating to login page...');
    await page.goto(process.env.NAUKRI_URL || 'https://www.naukri.com/nlogin/login');
    await page.waitForLoadState('networkidle');

    // Fill email field
    console.log('Entering email...');
    await page.locator('#usernameField').fill(process.env.USER_EMAIL);
    await page.waitForTimeout(500);

    // Fill password field
    console.log('Entering password...');
    await page.locator('#passwordField').fill(process.env.USER_PASSWORD);
    await page.waitForTimeout(500);

    // Click login button
    console.log('Clicking login button...');
    await page.locator('button[type="submit"].btn-large.btn-block.btn-bold.blue-btn').click();

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
