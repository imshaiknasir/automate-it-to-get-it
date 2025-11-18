const path = require('node:path');
const fs = require('fs').promises;
const { chromium, devices } = require('playwright');
const dotenv = require('dotenv');
const {
	loadStorageStatePath,
	saveStorageState,
	STORAGE_FILE,
} = require('./utils/storage-state');
const { logger, logExecution, generateExecutionId, formatDuration } = require('./utils/logger');
const { sendExecutionNotification } = require('./utils/telegram-notifier');
const { convertWebMtoMP4 } = require('./utils/video-converter');

const ENV_PATH = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: ENV_PATH });

const HOME_URL = 'https://www.naukri.com/';
const REGISTER_URL_MATCHER = /registration\/createAccount/i;
const LOGIN_URL_MATCHER = /nlogin\/login/i;

const PREFERRED_LOCATION = process.env.NAUKRI_TOGGLE_CITY || 'Kolkata';
const HEADLESS = process.env.HEADLESS === 'true';
const EXECUTION_ID = process.env.EXECUTION_ID || generateExecutionId();
const VIDEOS_DIR = path.join(__dirname, '..', 'videos');

function requireCredentials() {
	const email = process.env.USER_EMAIL;
	const password = process.env.USER_PASSWORD;

	if (!email || !password) {
		throw new Error('Missing USER_EMAIL or USER_PASSWORD in environment variables.');
	}

	return { email, password };
}

async function navigateToRegister(page) {
	logger.info('Navigating to registration page', { executionId: EXECUTION_ID });
	await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
	const registerLink = page.locator('#register_Layer');
	await registerLink.waitFor({ state: 'visible', timeout: 15000 });
	await Promise.all([
		page.waitForNavigation({ url: REGISTER_URL_MATCHER, timeout: 15000 }),
		registerLink.click({ trial: false }),
	]);
	logger.info('Registration page loaded', { executionId: EXECUTION_ID });
}

async function openLoginFromRegister(page) {
	logger.info('Opening login page', { executionId: EXECUTION_ID });
	const loginLink = page.locator('a[href="https://www.naukri.com/nlogin/login"]');
	await loginLink.waitFor({ state: 'visible', timeout: 15000 });
	await Promise.all([
		page.waitForNavigation({ url: LOGIN_URL_MATCHER, timeout: 15000 }),
		loginLink.click(),
	]);
	logger.info('Login page loaded', { executionId: EXECUTION_ID });
}

async function performLogin(page, credentials) {
	logger.info('Performing login', { executionId: EXECUTION_ID, email: credentials.email });
	const emailField = page.locator('#usernameField');
	const passwordField = page.locator('#passwordField');
	const submitButton = page.getByRole('button', { name: 'Login', exact: true });

	await emailField.waitFor({ state: 'visible', timeout: 15000 });
	await emailField.fill(credentials.email);

	await passwordField.waitFor({ state: 'visible', timeout: 15000 });
	await passwordField.fill(credentials.password);

	await submitButton.waitFor({ state: 'visible', timeout: 15000 });
	await Promise.all([
		page.waitForLoadState('domcontentloaded'),
		submitButton.click(),
	]);
	logger.info('Login form submitted', { executionId: EXECUTION_ID });
}

async function confirmLogin(page) {
	try {
		await page.waitForURL(/naukri.com\/(mnjuser|myhomepage)/i, { timeout: 20000 });
		logger.info('Login confirmed successfully', { executionId: EXECUTION_ID, url: page.url() });
	} catch (error) {
		logger.error('Login confirmation failed', { executionId: EXECUTION_ID, error: error.message });
		throw new Error('Login might have failed or took too long.');
	}
}

async function openProfileAndTogglePreferredLocation(page, cityName = 'Kolkata') {
	const profileLink = page.locator('.view-profile-wrapper a[href="/mnjuser/profile"]');
	await profileLink.waitFor({ state: 'visible', timeout: 30000 });
	logger.info('Opening profile page', { executionId: EXECUTION_ID });
	await profileLink.click();
	await page.waitForLoadState('domcontentloaded');

	const careerPreferencesHeading = page.locator('h1.section-heading:has-text("Your career preferences")');
	await careerPreferencesHeading.waitFor({ state: 'visible', timeout: 30000 });
	logger.info('Career preferences section visible', { executionId: EXECUTION_ID });

	logger.info('Opening career preferences editor', { executionId: EXECUTION_ID });
	await careerPreferencesHeading.locator('.new-pencil').first().click();

	const preferencesModal = page.locator('.styles_modal__gNwvD[role="dialog"]');
	await preferencesModal.waitFor({ state: 'visible', timeout: 20000 });
	await preferencesModal.locator('h1.title:has-text("Career preferences")').waitFor({ state: 'visible', timeout: 10000 });
	logger.info('Career preferences modal opened', { executionId: EXECUTION_ID });

	// Hard wait to ensure all chips are rendered and interactive
	await page.waitForTimeout(2000);

	// Use exact match regex to ensure we target the specific city chip and not a partial match
	const locationChip = preferencesModal.locator('.selectedChips .chip').filter({ hasText: new RegExp(`^${cityName}$`, 'i') });
	let action = '';
	
	if (await locationChip.count() > 0) {
		logger.info('Location already present, removing to toggle off', { executionId: EXECUTION_ID, location: cityName });
		action = 'removed';
		const removeIcon = locationChip.locator('.fn-chips-cross');
		
		// Verify remove icon exists
		const iconCount = await removeIcon.count();
		if (iconCount === 0) {
			throw new Error(`Remove icon not found for location: ${cityName}`);
		}

		// Ensure element is stable and visible
		await removeIcon.first().waitFor({ state: 'visible', timeout: 10000 });
		
		// Click to remove
		await removeIcon.first().click();
		
		// Wait for the chip to disappear from selected chips
		// We removed the catch block so that if it fails to detach, the script throws an error
		// and doesn't proceed to save invalid state.
		await locationChip.first().waitFor({ state: 'detached', timeout: 10000 });
	} else {
		logger.info('Location not present, adding to toggle on', { executionId: EXECUTION_ID, location: cityName });
		action = 'added';
		const locationInput = preferencesModal.locator('#location');
		await locationInput.click();
		await locationInput.fill('');

		const targetCity = cityName;
		await locationInput.type(targetCity, { delay: 120 });
		await page.waitForTimeout(800);

		const suggestion = preferencesModal.locator(`.sugItemWrapper:has-text("${cityName}")`).first();
		await suggestion.waitFor({ state: 'visible', timeout: 10000 });
		await suggestion.click();
		await preferencesModal.locator('.selectedChips .chip').filter({ hasText: new RegExp(`^${cityName}$`, 'i') }).waitFor({ state: 'visible', timeout: 10000 });
		logger.info('Location added to preferred locations', { executionId: EXECUTION_ID, location: cityName });
	}

	logger.info('Saving career preferences', { executionId: EXECUTION_ID, action, location: cityName });
	await preferencesModal.locator('button#submit-btn.btn-blue:has-text("Save")').click();
	await preferencesModal.waitFor({ state: 'hidden', timeout: 20000 });
	logger.info('Career preferences saved successfully', { executionId: EXECUTION_ID, action, location: cityName });
	
	return action;
}

async function main() {
	const startTime = Date.now();
	let videoPath = null;
	
	logger.info('Starting Naukri automation', {
		executionId: EXECUTION_ID,
		headless: HEADLESS,
		preferredLocation: PREFERRED_LOCATION,
		timestamp: new Date().toISOString(),
	});

	// Ensure videos directory exists
	await fs.mkdir(VIDEOS_DIR, { recursive: true });

	const desktopChrome = devices['Desktop Chrome'];
	const storageState = await loadStorageStatePath();
	const contextOptions = {
		viewport: desktopChrome.viewport,
		userAgent: desktopChrome.userAgent,
		locale: 'en-US',
		colorScheme: 'light',
		// Enable video recording for ALL runs
		recordVideo: {
			dir: VIDEOS_DIR,
			size: { width: 1280, height: 720 },
		},
	};

	if (storageState) {
		contextOptions.storageState = storageState;
	}

	const browser = await chromium.launch({ headless: HEADLESS, slowMo: 50 });
	const context = await browser.newContext(contextOptions);
	const page = await context.newPage();
	let sessionActive = false;
	let action = '';
	let success = false;
	let finalSummary = null;
	let executionError = null;

	try {
		if (storageState) {
			await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
			if (!LOGIN_URL_MATCHER.test(page.url())) {
				sessionActive = true;
				logger.info('Reusing stored session', { executionId: EXECUTION_ID, storageFile: STORAGE_FILE });
			} else {
				logger.warn('Stored session expired, performing fresh login', { executionId: EXECUTION_ID });
			}
		}

		if (!sessionActive) {
			const credentials = requireCredentials();
			await navigateToRegister(page);
			await openLoginFromRegister(page);
			await performLogin(page, credentials);
			await confirmLogin(page);
			await saveStorageState(context);
			sessionActive = true;
			logger.info('Login successful, storage state saved', { executionId: EXECUTION_ID, storageFile: STORAGE_FILE });
		}

		// After we have a valid session, open profile and toggle preferred location.
		action = await openProfileAndTogglePreferredLocation(page, PREFERRED_LOCATION);
		success = true;

		const duration = Date.now() - startTime;
		
		// Log execution summary
		finalSummary = {
			executionId: EXECUTION_ID,
			success: true,
			action,
			location: PREFERRED_LOCATION,
			duration: formatDuration(duration),
			durationMs: duration,
			timestamp: new Date().toISOString(),
			sessionReused: sessionActive && storageState !== null,
		};

		logExecution(finalSummary);
		logger.info('Automation completed successfully', finalSummary);
	} catch (error) {
		success = false;
		executionError = error;
		const duration = Date.now() - startTime;
		
		finalSummary = {
			executionId: EXECUTION_ID,
			success: false,
			action,
			location: PREFERRED_LOCATION,
			duration: formatDuration(duration),
			durationMs: duration,
			timestamp: new Date().toISOString(),
			error: error.message,
			stack: error.stack,
		};

		logExecution(finalSummary);
		logger.error('Automation failed', finalSummary);
	} finally {
		// Get video path before closing context
		try {
			videoPath = await page.video()?.path();
		} catch (e) {
			logger.warn('Could not get video path', { executionId: EXECUTION_ID, error: e.message });
		}

		// Close context explicitly to ensure video is saved and handle released
		await context.close();
		await browser.close();

				// Rename video with timestamp
		if (videoPath) {
			try {
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const newFileName = `naukri-automation-${timestamp}.webm`;
				const newVideoPath = path.join(VIDEOS_DIR, newFileName);
				
				// Retry rename if file is busy
				for (let i = 0; i < 5; i++) {
					try {
						await fs.rename(videoPath, newVideoPath);
						videoPath = newVideoPath;
						break;
					} catch (renameError) {
						if (renameError.code === 'EBUSY' && i < 4) {
							await new Promise(resolve => setTimeout(resolve, 1000));
							continue;
						}
						throw renameError;
					}
				}

				// Convert to MP4 for Telegram streaming compatibility
				try {
					const mp4Path = videoPath.replace('.webm', '.mp4');
					await convertWebMtoMP4(videoPath, mp4Path);
					
					// Remove original WebM to save space
					await fs.unlink(videoPath);
					videoPath = mp4Path;
					
					logger.info('Video converted to MP4', { executionId: EXECUTION_ID, videoPath });
				} catch (conversionError) {
					logger.warn('Video conversion failed, keeping WebM', { 
						executionId: EXECUTION_ID, 
						error: conversionError.message 
					});
				}
				
				if (finalSummary) {
					finalSummary.videoPath = videoPath;
				}

				logger.info('Video recording saved and processed', {
					executionId: EXECUTION_ID,
					videoPath,
					success,
				});
			} catch (e) {
				logger.warn('Failed to process video', { executionId: EXECUTION_ID, error: e.message });
			}
		}		// Send notification with video
		if (finalSummary) {
			await sendExecutionNotification(finalSummary);
		}

		if (executionError) {
			throw executionError;
		}
	}
}

main().catch((error) => {
	logger.error('Unhandled error in main', {
		executionId: EXECUTION_ID,
		error: error.message,
		stack: error.stack,
	});
	process.exitCode = 1;
});
