import * as fs from 'fs';
import * as path from 'path';

// Get the absolute path to the src/scripts directory
const scriptsDir = path.join(__dirname, 'scripts');

// Function to list all TypeScript files in the scripts directory
function listScripts(): void {
  try {
    // Check if directory exists
    if (!fs.existsSync(scriptsDir)) {
      console.error(`Error: Directory ${scriptsDir} does not exist`);
      return;
    }

    // Read all files in the directory
    const files = fs.readdirSync(scriptsDir);
    
    // Filter for only TypeScript files
    const tsFiles = files.filter(file => file.endsWith('.ts'));
    
    if (tsFiles.length === 0) {
      console.log('No TypeScript scripts found in src/scripts/');
      return;
    }
    
    console.log('Available scripts to run:');
    console.log('------------------------');
    
    // Display each script with the npx tsx command
    tsFiles.forEach(file => {
      console.log(`npx tsx src/scripts/${file}`);
    });
    
    console.log('------------------------');
    
  } catch (error) {
    console.error('Error listing scripts:', error);
  }
}

// Execute the function
listScripts(); 