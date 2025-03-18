import * as fs from 'fs';
import * as path from 'path';

// Get the absolute path to the dist/scripts directory
const scriptsDir = path.join(__dirname, '../dist/scripts');

// Function to list all JavaScript files in the scripts directory
function listScripts(): void {
  try {
    // Check if directory exists
    if (!fs.existsSync(scriptsDir)) {
      console.error(`Error: Directory ${scriptsDir} does not exist`);
      return;
    }

    // Read all files in the directory
    const files = fs.readdirSync(scriptsDir);
    
    // Filter for only JavaScript files
    const jsFiles = files.filter(file => file.endsWith('.js'));
    
    if (jsFiles.length === 0) {
      console.log('No JavaScript scripts found in dist/scripts/');
      return;
    }
    
    console.log('Available scripts to run:');
    console.log('------------------------');
    
    // Display each script with the node command
    jsFiles.forEach(file => {
      console.log(`node dist/scripts/${file}`);
    });
    
    console.log('------------------------');
    
  } catch (error) {
    console.error('Error listing scripts:', error);
  }
}

// Execute the function
listScripts(); 