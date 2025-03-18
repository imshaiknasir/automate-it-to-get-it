import { Page } from "@playwright/test";
import fs from 'fs/promises';
import fsExtra from 'fs-extra';

// Click on Career Profile tab
export async function clickOnCareerProfileTab(page: Page) {
    try {
        await page.getByRole('listitem').filter({ hasText: 'Career profile' }).click();
        console.log('✅ Clicked on Career Profile tab');
    } catch (error) {
        console.error('Error in clickOnCareerProfileTab:', error);
        throw error;
    }
};

// Checker if Career Profile tab is visible
export async function isCareerProfileTabVisible(page: Page) {
    try {
        const careerProfileTab = page.getByText('Career profileeditOneTheme');
        return await careerProfileTab.isVisible();
    } catch (error) {
        console.error('Error in isCareerProfileTabVisible:', error);
        throw error;
    }
};

// Click on Edit Career Profile button
export async function clickOnEditCareerProfileButton(page: Page) {
    try {
        await page.locator('#lazyDesiredProfile').getByText('editOneTheme').click();
        console.log('✅ Clicked on Edit Career Profile button');
    } catch (error) {
        console.error('Error in clickOnEditCareerProfileButton:', error);
        throw error;
    }
};

// Checker if Edit Career Profile form is visible
export async function isEditCareerProfileFormVisible(page: Page) {
    try {
        const editCareerProfileForm = page.locator('#desiredProfileForm');
        return await editCareerProfileForm.isVisible();
    } catch (error) {
        console.error('Error in isEditCareerProfileFormVisible:', error);
        throw error;
    }
};

// scrollinto preferred work location
export async function scrollIntoPreferredWorkLocation(page: Page) {
    try {
        await page.getByText('Preferred work location (Max').scrollIntoViewIfNeeded();
        console.log('✅ Scrolled into Preferred Work Location');
    } catch (error) {
        console.error('Error in scrollIntoPreferredWorkLocation:', error);
        throw error;
    }
};

// Get and save all locations to a JSON file
export async function saveAllLocations(page: Page) {
    try {
        const locations = page.locator('//div[@class="chipsContainer"]/div');
        const locationsArray: string[] = []; // Array to hold locations
        
        for (const location of await locations.all()) {
            const locationText = await location.locator('//span').textContent();
            locationsArray.push(locationText || ''); // Add location to array
        }
        
        // Save locations array to locations.json as a JSON object
        const locationsObject = { locations: locationsArray };
        const filePath = 'temp/locations.json';
        
        // Ensure the directory exists
        await fs.mkdir('temp', { recursive: true });
        // Create the file and then write to it
        await fs.writeFile(filePath, '[]'); // Create the file first (with empty JSON array)
        await fs.writeFile(filePath, JSON.stringify(locationsObject, null, 2)); // Then write the actual content
        
        console.log('✅ All locations have been saved to a temporary json file as JSON object');
        return locationsArray;
    } catch (error) {
        console.error('Error in saveAllLocations:', error);
        throw error;
    }
}

// Remove all locations and save changes
export async function removeAllLocations(page: Page) {
    try {
        const locations = page.locator('//div[@class="chipsContainer"]/div/a');
        
        while (await locations.count() > 0) {
            await locations.first().click();
            await page.waitForTimeout(1 * 1000);
        }
        console.log('✅ Removed all locations');

        await page.getByRole('button', { name: 'Save', exact: true }).click();
        console.log('✅ Saved all changes');
    } catch (error) {
        console.error('Error in removeAllLocations:', error);
        throw error;
    }
}

// Add locations
export async function addLocations(page: Page) {
    try {
        if (!fsExtra.existsSync('temp/locations.json')) {
            console.log('locations.json file not found, exiting addLocations function.');
            return;
        }
        const locationsData = await fs.readFile('temp/locations.json', 'utf-8');
        const locationsObject = JSON.parse(locationsData);
        let locationsArray: string[] = locationsObject.locations;
        let newLocationsArray: string[] = []
        for (const location of locationsArray) {
            if (location.includes("/")) {
                newLocationsArray.push(location.split("/")[0]);
            } else {
                newLocationsArray.push(location);
            }
        }
        locationsArray = newLocationsArray;
        const locationInputField = page.locator("//input[@id='locationSugg']");
        await locationInputField.click();
        await page.waitForTimeout(2 * 1000);

        /**
        const listOfPopularLocations = page.locator("//div[@class='topCitiesSuggestions']//li")
        let textContentOfPopularLocations: string[] = []
        for (const location of await listOfPopularLocations.all()) {
            let textContent = (await location.textContent()) || '';
            textContent = textContent.replace('UnChecked', '');
            textContent = textContent.trim();
            textContentOfPopularLocations.push(textContent);
        }

        let locationsThatMatchWithTheLocationsDataInTempLocationsJsonFile: string[] = []
        let locationsThatDoNotMatchWithTheLocationsDataInTempLocationsJsonFile: string[] = []
        for (const location of locationsArray) {
            if (textContentOfPopularLocations.includes(location)) {
                locationsThatMatchWithTheLocationsDataInTempLocationsJsonFile.push(location);
            } else {
                locationsThatDoNotMatchWithTheLocationsDataInTempLocationsJsonFile.push(location);
            }
        }
        */

        for (const location of locationsArray) {
            await locationInputField.pressSequentially(location, { delay: 200 });
            await page.waitForTimeout(1 * 1000);
            await page.locator("//div[@id='sugDrp_locationSugg']//li").first().click();
            await page.waitForTimeout(1 * 1000);
        }
        console.log('✅ Added all locations back');
        
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        console.log('✅ Saved all changes');
        
        await fs.unlink('temp/locations.json');
        console.log('✅ Removed the temporary json file');
    } catch (error) {
        console.error('Error in addLocations:', error);
        throw error;
    }
};
