const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')
import { login, homepage } from '../helperFunctions';

import { profilePage } from '../helperFunctions';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
chromium.use(stealth());

(async () => {
  try {
    const browser = await chromium.launch({ headless: false });
    
    // Create a context with video recording enabled
    const context = await browser.newContext({
      recordVideo: {
        dir: path.join(__dirname, '../../videos/'),
        size: { width: 1280, height: 720 },
      }
    });
    const page = await context.newPage();

    await page.goto(process.env.NAUKRI_URL as string, { waitUntil: 'load'});
    await login.clickOnLoginButton(page);
    await login.enterEmailAndPassword(page, process.env.USER_EMAIL as string, process.env.USER_PASSWORD as string);
    await login.clickOnLoginButtonOnDrawer(page);

    if (await login.waitForHomePage(page)) {
        console.log('Login successful');
        await homepage.gotoToProfilePage(page);

        await profilePage.careerProfile.clickOnCareerProfileTab(page);
        await profilePage.careerProfile.clickOnEditCareerProfileButton(page);
        await profilePage.careerProfile.scrollIntoPreferredWorkLocation(page);
        await profilePage.careerProfile.saveAllLocations(page);
        await profilePage.careerProfile.removeAllLocations(page);
        await profilePage.careerProfile.clickOnEditCareerProfileButton(page);
        await profilePage.careerProfile.scrollIntoPreferredWorkLocation(page);
        await profilePage.careerProfile.addLocations(page);

        await login.logout(page);
    } else {
        console.log('Login failed');
    }
    
    await browser.close();

  } catch (error) {
    console.error('Error occurred:', error);
    process.exit(1);
  }

  console.log('\n\n 🎥 Video path:', path.join(__dirname, '../../videos/'));
})();