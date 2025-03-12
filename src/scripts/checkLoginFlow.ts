const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')
import * as loginPageFunctions from '../helperFunctions/loginFunctions';
import dotenv from 'dotenv';

dotenv.config();
chromium.use(stealth());

(async () => {
  try {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(process.env.NAUKRI_URL as string, { waitUntil: 'load'});
    
    // Initial page screenshot
    await page.screenshot({ path: 'screenshots/initial_page.png' });
    
    // Perform login steps with screenshots
    await loginPageFunctions.clickOnLoginButton(page);
    await loginPageFunctions.enterEmailAndPassword(page, process.env.USER_EMAIL as string, process.env.USER_PASSWORD as string);
    await loginPageFunctions.clickOnLoginButtonOnDrawer(page);

    if (await loginPageFunctions.waitForHomePage(page)) {
        console.log('Login successful');
        await page.screenshot({ path: 'screenshots/after_login.png' });

        await loginPageFunctions.logout(page);
        await page.screenshot({ path: 'screenshots/after_logout.png' });
    } else {
        console.log('Login failed');
    }
    
    await browser.close();
  } catch (error) {
    console.error('Error occurred:', error);
    process.exit(1);
  }
})();