/**
 * Validation script to verify browser flags configuration
 * This script checks that anti-detection flags are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating browser flags configuration...\n');

// Read the naukri-automation.js file
const scriptPath = path.join(__dirname, 'naukri-automation.js');
const scriptContent = fs.readFileSync(scriptPath, 'utf8');

let validationsPassed = 0;
let validationsFailed = 0;
let warnings = 0;

// Critical checks
console.log('=== CRITICAL FLAGS ===');

// Check 1: Stealth plugin is used
if (scriptContent.includes("require('puppeteer-extra-plugin-stealth')") && 
    scriptContent.includes('chromium.use(stealth)')) {
  console.log('✅ Stealth plugin enabled');
  validationsPassed++;
} else {
  console.log('❌ Stealth plugin NOT enabled');
  validationsFailed++;
}

// Check 2: --disable-blink-features=AutomationControlled is present
if (scriptContent.includes('--disable-blink-features=AutomationControlled')) {
  console.log('✅ AutomationControlled feature disabled');
  validationsPassed++;
} else {
  console.log('❌ AutomationControlled feature NOT disabled');
  validationsFailed++;
}

// Check 3: --enable-automation flag is NOT present (except in comments)
// Split content into lines and check for the flag not in comments
const lines = scriptContent.split('\n');
const enableAutomationInCode = lines.some(line => {
  // Remove comments from the line
  const codeOnly = line.split('//')[0].trim();
  // Check if flag exists in the non-comment part
  return codeOnly.includes("'--enable-automation'") || codeOnly.includes('"--enable-automation"');
});

if (!enableAutomationInCode) {
  console.log('✅ --enable-automation flag NOT present (good!)');
  validationsPassed++;
} else {
  console.log('❌ --enable-automation flag IS PRESENT (BAD - enables detection)');
  validationsFailed++;
}

console.log('\n=== BROWSER CONTEXT ===');

// Check 4: User agent is set
if (scriptContent.includes('userAgent:') && scriptContent.includes('Chrome/')) {
  console.log('✅ Custom user agent configured');
  validationsPassed++;
} else {
  console.log('❌ Custom user agent NOT configured');
  validationsFailed++;
}

// Check 5: Timezone is set
if (scriptContent.includes("timezoneId: 'Asia/Kolkata'")) {
  console.log('✅ Timezone configured (Asia/Kolkata)');
  validationsPassed++;
} else {
  console.log('⚠️  Timezone not set to Asia/Kolkata');
  warnings++;
}

// Check 6: Geolocation is set
if (scriptContent.includes('geolocation:') && scriptContent.includes('latitude:')) {
  console.log('✅ Geolocation configured');
  validationsPassed++;
} else {
  console.log('⚠️  Geolocation not configured');
  warnings++;
}

console.log('\n=== CUSTOM SCRIPT INJECTION ===');

// Check 7: navigator.webdriver override
if (scriptContent.includes("navigator, 'webdriver'") && 
    scriptContent.includes('get: () => undefined')) {
  console.log('✅ navigator.webdriver override present');
  validationsPassed++;
} else {
  console.log('⚠️  navigator.webdriver override not found');
  warnings++;
}

// Check 8: window.chrome mock
if (scriptContent.includes('window.chrome')) {
  console.log('✅ window.chrome mock present');
  validationsPassed++;
} else {
  console.log('⚠️  window.chrome mock not found');
  warnings++;
}

console.log('\n=== HUMAN BEHAVIOR SIMULATION ===');

// Check 9: Human mouse movement
if (scriptContent.includes('function humanMouseMove')) {
  console.log('✅ Human mouse movement function present');
  validationsPassed++;
} else {
  console.log('⚠️  Human mouse movement not implemented');
  warnings++;
}

// Check 10: Human typing
if (scriptContent.includes('function humanType')) {
  console.log('✅ Human typing function present');
  validationsPassed++;
} else {
  console.log('⚠️  Human typing not implemented');
  warnings++;
}

// Check 11: Random scrolling
if (scriptContent.includes('function randomScroll')) {
  console.log('✅ Random scrolling function present');
  validationsPassed++;
} else {
  console.log('⚠️  Random scrolling not implemented');
  warnings++;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('VALIDATION SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Passed: ${validationsPassed}`);
console.log(`❌ Failed: ${validationsFailed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log('='.repeat(50));

if (validationsFailed === 0) {
  console.log('\n🎉 All critical validations PASSED!');
  console.log('The browser flags configuration is properly set up for anti-detection.');
  process.exit(0);
} else {
  console.log('\n❌ Some critical validations FAILED!');
  console.log('Please review the configuration and fix the issues above.');
  process.exit(1);
}
