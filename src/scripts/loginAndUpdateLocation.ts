const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')
import { login, homepage } from '../helperFunctions';
import { profilePage } from '../helperFunctions';
import { startChatbotRemover } from './chatbotRemover';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs'; // Import the fs module

dotenv.config();
chromium.use(stealth());

// Function to parse .env and get credentials
function getCredentials() {
  const envPath = path.resolve(__dirname, '../../.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const lines = envContent.split('\n');
  const credentials = [];
  let userEmail = '';
  let userPassword = '';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('USER_EMAIL=')) {
      userEmail = trimmedLine.substring('USER_EMAIL='.length).replace(/['"]/g, '');
    } else if (trimmedLine.startsWith('USER_PASSWORD=')) {
      userPassword = trimmedLine.substring('USER_PASSWORD='.length).replace(/['"]/g, '');
    } else if (trimmedLine.startsWith('# USER_EMAIL=')) {
      userEmail = trimmedLine.substring('# USER_EMAIL='.length).replace(/['"]/g, '');
    } else if (trimmedLine.startsWith('# USER_PASSWORD=')) {
      userPassword = trimmedLine.substring('# USER_PASSWORD='.length).replace(/['"]/g, '');
    }

    if(userEmail && userPassword && !trimmedLine.startsWith('# ')) {
        credentials.push({ USER_EMAIL: userEmail, USER_PASSWORD: userPassword });
        userEmail = '';
        userPassword = '';
    } else if(userEmail && userPassword && trimmedLine.startsWith('# ')) {
        credentials.push({ USER_EMAIL: userEmail, USER_PASSWORD: userPassword });
        userEmail = '';
        userPassword = '';
    }
  }
  return credentials;
}

(async () => {
  const allCredentials = getCredentials();

  for (const credentials of allCredentials) { // Loop through each set of credentials
    try {
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext({
        recordVideo: {
          dir: path.join(__dirname, '../../videos/'),
          size: { width: 1280, height: 720 },
        }
      });
      const page = await context.newPage();

      // Set environment variables for the current user
      process.env.USER_EMAIL = credentials.USER_EMAIL;
      process.env.USER_PASSWORD = credentials.USER_PASSWORD;

      await page.goto(process.env.NAUKRI_URL as string, { waitUntil: 'load' });

      const stopChatbotRemover = await startChatbotRemover(page);

      await login.clickOnLoginButton(page);
      await login.enterEmailAndPassword(page, process.env.USER_EMAIL as string, process.env.USER_PASSWORD as string);
      await login.clickOnLoginButtonOnDrawer(page);

      if (await login.waitForHomePage(page)) {
        console.log(`Login successful for ${credentials.USER_EMAIL}`);
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
        console.log(`Login failed for ${credentials.USER_EMAIL}`);
      }

      stopChatbotRemover();
      await browser.close();
    } catch (error) {
      console.error(`Error occurred for ${credentials.USER_EMAIL}: `, error);
    }
  } // End of credentials loop
  console.log('\n\n 🎥 Video path:', path.join(__dirname, '../../videos/'));
})();