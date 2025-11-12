const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Enable stealth plugin to reduce automation fingerprints
chromium.use(stealth);

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function fillWithFallback(page, selectors, value, fieldLabel) {
  if (!value) {
    throw new Error(`Missing value for ${fieldLabel}. Check environment configuration.`);
  }

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.fill(value);
      console.log(`Filled ${fieldLabel} using selector: ${selector}`);
      return;
    } catch (error) {
      console.log(`Selector ${selector} failed for ${fieldLabel}: ${error.message}`);
    }
  }

  throw new Error(`Could not locate ${fieldLabel} input on the page.`);
}

async function clickWithFallback(page, selectors, description) {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await locator.scrollIntoViewIfNeeded();
      await locator.click();
      console.log(`Clicked ${description} using selector: ${selector}`);
      return;
    } catch (error) {
      console.log(`Selector ${selector} failed for ${description}: ${error.message}`);
    }
  }

  throw new Error(`Could not click ${description}; no selectors matched.`);
}

(async () => {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  const launchOptions = {
    headless: isCI,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  };

  const browser = await chromium.launch(launchOptions);

  const videosDir = path.join(__dirname, '..', 'videos');
  await fs.promises.mkdir(videosDir, { recursive: true });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    recordVideo: { dir: videosDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  await ensureDir(screenshotsDir);

  try {
    console.log('Navigating to Naukri.com...');
    await page.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: isCI ? 90000 : 60000 });
    console.log('Page loaded.');

    console.log('Waiting for Jobseeker Login button...');
    const loginButton = page.locator('a#login_Layer.nI-gNb-lg-rg__login[title="Jobseeker Login"]');
    await loginButton.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Clicking Jobseeker Login button...');
    await loginButton.click();
    console.log('Jobseeker Login button clicked.');

    console.log('Waiting for email and password fields...');
    const emailField = page.locator('form[name="login-form"] input[type="text"]');
    const passwordField = page.locator('form[name="login-form"] input[type="password"]');
    await Promise.all([
      emailField.waitFor({ state: 'visible', timeout: 30000 }),
      passwordField.waitFor({ state: 'visible', timeout: 30000 })
    ]);
    console.log('Email and password fields are visible.');

    const emailSelectors = [
      '#usernameField',
      'input[type="text"][placeholder*="Email"]',
      'input[type="text"][placeholder*="email"]',
      'form[name="login-form"] input[type="text"]'
    ];
    const passwordSelectors = [
      '#passwordField',
      'form[name="login-form"] input[type="password"]',
      'input[type="password"][placeholder*="Password"]'
    ];

    console.log('Entering credentials...');
    await fillWithFallback(page, emailSelectors, process.env.USER_EMAIL, 'email');
    await fillWithFallback(page, passwordSelectors, process.env.USER_PASSWORD, 'password');

    console.log('Clicking sign-in button...');
    const loginButtonSelectors = [
      'form[name="login-form"] button[type="submit"]',
      'button:has-text("Login")',
      'input[type="submit"]',
      'button.btn-primary[type="submit"]'
    ];
    await clickWithFallback(page, loginButtonSelectors, 'login button');

    console.log('Waiting for login navigation...');
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {
      console.log('Network idle wait timed out; continuing with URL checks.');
    });

    try {
      await page.waitForURL('**/mnjuser/homepage', { timeout: 30000 });
    } catch {
      console.log('Homepage redirect not detected; verifying via profile link.');
    }

    const profileLink = page.locator('.view-profile-wrapper a[href="/mnjuser/profile"]');
    await profileLink.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Login successful.');

    console.log('Opening profile page...');
    await profileLink.click();
    await page.waitForLoadState('domcontentloaded');

    const careerPreferencesHeading = page.locator('h1.section-heading:has-text("Your career preferences")');
    await careerPreferencesHeading.waitFor({ state: 'visible', timeout: 30000 });
    console.log('Career preferences section is visible.');

    console.log('Opening career preferences editor...');
    await careerPreferencesHeading.locator('.new-pencil').first().click();

    const preferencesModal = page.locator('.styles_modal__gNwvD[role="dialog"]');
    await preferencesModal.waitFor({ state: 'visible', timeout: 20000 });
    await preferencesModal.locator('h1.title:has-text("Career preferences")').waitFor({ state: 'visible', timeout: 10000 });
    console.log('Career preferences modal open.');

    const kolkataChip = preferencesModal.locator('.selectedChips .chip:has-text("Kolkata")');
    if (await kolkataChip.count() > 0) {
      console.log('Kolkata already present. Removing to refresh.');
      await kolkataChip.locator('.fn-chips-cross').click();
      await kolkataChip.waitFor({ state: 'hidden', timeout: 10000 });
    }

    const locationInput = preferencesModal.locator('#location');
    await locationInput.click();
    await locationInput.fill('');

    const targetCity = 'Kolkata';
    for (const char of targetCity) {
      await locationInput.type(char, { delay: 150 });
    }
    await page.waitForTimeout(800);

    const suggestion = preferencesModal.locator('.sugItemWrapper:has-text("Kolkata")').first();
    await suggestion.waitFor({ state: 'visible', timeout: 10000 });
    await suggestion.click();
    await preferencesModal.locator('.selectedChips .chip:has-text("Kolkata")').waitFor({ state: 'visible', timeout: 10000 });
    console.log('Kolkata added to preferred locations.');

    console.log('Saving career preferences...');
    await preferencesModal.locator('button#submit-btn.btn-blue:has-text("Save")').click();
    await preferencesModal.waitFor({ state: 'hidden', timeout: 20000 });
    console.log('Career preferences saved.');

    console.log('Opening user menu for logout...');
    const menuIcon = page.locator('.nI-gNb-drawer__icon');
    await menuIcon.click();
    await page.waitForTimeout(500);

    console.log('Clicking logout...');
    const logoutLink = page.locator('a.nI-gNb-list-cta[title="Logout"]');
    await logoutLink.waitFor({ state: 'visible', timeout: 15000 });
    await logoutLink.click();

    await page.locator('a#login_Layer.nI-gNb-lg-rg__login:has-text("Login")').waitFor({ state: 'visible', timeout: 30000 });
    console.log('Logout successful.');
  } catch (error) {
    console.error('Automation failed:', error.message);
    const timestamp = Date.now();
    try {
      const screenshotPath = path.join(screenshotsDir, `error-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.error(`Error screenshot saved: ${screenshotPath}`);
    } catch (screenshotError) {
      console.error(`Unable to capture error screenshot: ${screenshotError.message}`);
    }

    try {
      const htmlPath = path.join(screenshotsDir, `error-${timestamp}.html`);
      const htmlContent = await page.content();
      await fs.promises.writeFile(htmlPath, htmlContent);
      console.error(`Error HTML saved: ${htmlPath}`);
    } catch (htmlError) {
      console.error(`Unable to capture error HTML: ${htmlError.message}`);
    }
  } finally {
    const video = typeof page.video === 'function' ? page.video() : null;
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (closeError) {
      console.warn('Could not close page cleanly:', closeError.message);
    }
    try {
      await context.close();
    } catch (ctxError) {
      console.warn('Could not close context cleanly:', ctxError.message);
    }
    if (video) {
      try {
        const videoPath = await video.path();
        console.log(`Session video saved at: ${videoPath}`);
      } catch (videoError) {
        console.warn('Could not retrieve video path:', videoError.message);
      }
    }
    await browser.close();
  }
})();
