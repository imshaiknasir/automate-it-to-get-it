const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
      
      // Human-like typing with random delays
      await locator.click();
      await page.waitForTimeout(100 + Math.random() * 200);
      await locator.fill('');
      
      for (const char of value) {
        await locator.type(char, { delay: 50 + Math.random() * 100 });
      }
      
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
      
      // Human-like behavior: hover before clicking
      await locator.hover();
      await page.waitForTimeout(100 + Math.random() * 300);
      await locator.click();
      await page.waitForTimeout(200 + Math.random() * 400);
      
      console.log(`Clicked ${description} using selector: ${selector}`);
      return;
    } catch (error) {
      console.log(`Selector ${selector} failed for ${description}: ${error.message}`);
    }
  }

  throw new Error(`Could not click ${description}; no selectors matched.`);
}

/**
 * Decodes base64-encoded CV files from environment variables and saves them temporarily
 * @returns {Array<{path: string, ext: string}>} Array of decoded CV file paths
 */
function decodeAndSaveCVs() {
  const cvFiles = [];
  const tempDir = path.join(__dirname, '..', 'temp-cvs');
  
  // Create temp directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Check for CV files in environment (CV_FILE_1_BASE64, CV_FILE_2_BASE64, etc.)
  for (let i = 1; i <= 10; i++) {
    const base64Key = `CV_FILE_${i}_BASE64`;
    const extKey = `CV_FILE_${i}_EXT`;
    
    const base64Content = process.env[base64Key];
    const fileExt = process.env[extKey] || 'pdf';
    
    if (base64Content) {
      try {
        const buffer = Buffer.from(base64Content, 'base64');
        const filePath = path.join(tempDir, `resume-${i}.${fileExt}`);
        fs.writeFileSync(filePath, buffer);
        cvFiles.push({ path: filePath, ext: fileExt });
        console.log(`Decoded CV ${i}: ${filePath} (${(buffer.length / 1024).toFixed(2)} KB)`);
      } catch (error) {
        console.warn(`Failed to decode ${base64Key}: ${error.message}`);
      }
    }
  }
  
  return cvFiles;
}

/**
 * Selects a random CV from the available decoded CVs
 * @param {Array<{path: string, ext: string}>} cvFiles Array of CV file objects
 * @returns {{path: string, ext: string}|null} Randomly selected CV or null if none available
 */
function selectRandomCV(cvFiles) {
  if (cvFiles.length === 0) {
    return null;
  }
  
  const randomIndex = Math.floor(Math.random() * cvFiles.length);
  const selected = cvFiles[randomIndex];
  console.log(`Selected CV ${randomIndex + 1} of ${cvFiles.length}: ${path.basename(selected.path)}`);
  return selected;
}

/**
 * Cleans up temporary CV files after upload
 * @param {string} tempDir Directory containing temporary CV files
 */
function cleanupTempFiles(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
      console.log('Temporary CV files cleaned up.');
    }
  } catch (error) {
    console.warn(`Failed to cleanup temp files: ${error.message}`);
  }
}

(async () => {
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  const launchOptions = {
    headless: isCI,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--lang=en-IN',
      '--window-size=1920,1080'
    ]
  };

  const browser = await chromium.launch(launchOptions);

  const videosDir = path.join(__dirname, '..', 'videos');
  await fs.promises.mkdir(videosDir, { recursive: true });

  // Add viewport randomization for more natural appearance
  const viewportWidth = 1920 + Math.floor(Math.random() * 100);
  const viewportHeight = 1080 + Math.floor(Math.random() * 100);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: viewportWidth, height: viewportHeight },
    deviceScaleFactor: 1,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    geolocation: { longitude: 88.3639, latitude: 22.5726 },
    permissions: ['geolocation'],
    hasTouch: false,
    isMobile: false,
    colorScheme: 'light',
    recordVideo: { dir: videosDir, size: { width: 1280, height: 720 } }
  });

  const page = await context.newPage();
  
  // Inject scripts to mask automation detection
  await page.addInitScript(() => {
    // Overwrite the `navigator.webdriver` property
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Overwrite the `plugins` property to add fake plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // Overwrite the `languages` property
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en', 'en-IN'],
    });

    // Add chrome runtime object
    window.chrome = {
      runtime: {},
    };

    // Mock permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  });
  
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  await ensureDir(screenshotsDir);

  try {
    console.log('Navigating to Naukri.com...');
    await page.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: isCI ? 90000 : 60000 });
    await page.waitForTimeout(1000 + Math.random() * 2000);
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

    // === CV Upload Flow ===
    let uploadedCV = false;
    const tempDir = path.join(__dirname, '..', 'temp-cvs');
    
    try {
      console.log('\n--- Starting CV Upload Process ---');
      
      // Decode all available CVs from environment variables
      const cvFiles = decodeAndSaveCVs();
      
      if (cvFiles.length === 0) {
        console.log('No CV files found in environment variables. Skipping CV upload.');
        console.log('To enable CV uploads, add CV_FILE_1_BASE64 (and optionally CV_FILE_1_EXT) to your secrets.');
      } else {
        // Select a random CV
        const selectedCV = selectRandomCV(cvFiles);
        
        if (selectedCV) {
          console.log(`\nUploading resume: ${path.basename(selectedCV.path)}`);
          
          // Scroll to resume section
          const resumeContainer = page.locator('.resume-upload-container').first();
          await resumeContainer.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          
          // Click the "Update resume" button
          const updateResumeButton = resumeContainer.locator('button.upload-button:has-text("Update resume")');
          await updateResumeButton.waitFor({ state: 'visible', timeout: 15000 });
          console.log('Update resume button found.');
          
          // Get the file input and upload the CV
          const fileInput = resumeContainer.locator('input[type="file"].upload-input');
          await fileInput.setInputFiles(selectedCV.path);
          console.log('CV file uploaded to input.');
          
          // Wait for progress bar to appear
          console.log('Waiting for upload progress...');
          const progressBar = page.locator('.resume-upload-container .progressbar');
          await progressBar.waitFor({ state: 'visible', timeout: 10000 });
          console.log('Upload started - progress bar visible.');
          
          // Wait for progress bar to reach 100% and disappear
          await progressBar.waitFor({ state: 'hidden', timeout: 30000 });
          console.log('Upload complete - progress bar hidden.');
          
          // Additional verification: wait a bit for any post-upload processing
          await page.waitForTimeout(2000);
          
          uploadedCV = true;
          console.log('✅ CV uploaded successfully!');
        }
      }
    } catch (error) {
      console.error('CV upload failed:', error.message);
      console.error('This is non-critical; continuing with logout.');
      
      // Capture screenshot of CV upload failure
      try {
        const timestamp = Date.now();
        const screenshotPath = path.join(screenshotsDir, `cv-upload-error-${timestamp}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.error(`CV upload error screenshot saved: ${screenshotPath}`);
      } catch (screenshotError) {
        console.error('Unable to capture CV upload error screenshot.');
      }
    } finally {
      // Always cleanup temporary CV files
      cleanupTempFiles(tempDir);
      console.log('--- CV Upload Process Completed ---\n');
    }

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
