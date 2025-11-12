const fs = require('fs');
const path = require('path');

/**
 * Encodes a PDF/DOC file to base64 format for GitHub Secrets storage
 * 
 * Usage: node scripts/prepare-cv.js <path-to-resume-file>
 * Example: node scripts/prepare-cv.js ~/Documents/resume-v1.pdf
 * 
 * This script helps you securely encode your resume files for storage
 * as GitHub Secrets, preventing them from being committed to the repository.
 */

const filePath = process.argv[2];

if (!filePath) {
  console.error('❌ Error: No file path provided\n');
  console.log('Usage: node scripts/prepare-cv.js <path-to-resume-file>');
  console.log('Example: node scripts/prepare-cv.js ~/Documents/resume.pdf\n');
  process.exit(1);
}

const resolvedPath = path.resolve(filePath.replace(/^~/, process.env.HOME || ''));

if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ Error: File not found: ${resolvedPath}\n`);
  process.exit(1);
}

try {
  const fileBuffer = fs.readFileSync(resolvedPath);
  const base64String = fileBuffer.toString('base64');
  const fileName = path.basename(resolvedPath);
  const fileExtension = path.extname(resolvedPath).toLowerCase().replace('.', '');
  const fileSize = fileBuffer.length;
  const base64Size = base64String.length;
  
  // Supported formats
  const supportedFormats = ['pdf', 'doc', 'docx', 'rtf'];
  if (!supportedFormats.includes(fileExtension)) {
    console.warn(`⚠️  Warning: File format '${fileExtension}' may not be supported by Naukri.com`);
    console.warn(`   Supported formats: ${supportedFormats.join(', ')}\n`);
  }
  
  // Size validation
  const maxFileSize = 2 * 1024 * 1024; // 2MB
  const maxSecretSize = 64 * 1024; // 64KB
  
  console.log('═'.repeat(70));
  console.log('📄 Resume File Encoding Complete');
  console.log('═'.repeat(70));
  console.log(`File name:        ${fileName}`);
  console.log(`File format:      ${fileExtension.toUpperCase()}`);
  console.log(`Original size:    ${(fileSize / 1024).toFixed(2)} KB`);
  console.log(`Base64 size:      ${(base64Size / 1024).toFixed(2)} KB`);
  console.log('═'.repeat(70));
  
  // Warnings
  if (fileSize > maxFileSize) {
    console.warn('\n⚠️  WARNING: File exceeds Naukri.com size limit (2MB)');
    console.warn('   Your resume may be rejected during upload.');
    console.warn('   Consider compressing your file.\n');
  }
  
  if (base64Size > maxSecretSize) {
    console.error('\n❌ ERROR: Base64 size exceeds GitHub Secret limit (64KB)');
    console.error('   Current size: ' + (base64Size / 1024).toFixed(2) + ' KB');
    console.error('\n   Solutions:');
    console.error('   1. Compress your PDF (reduce images, remove metadata)');
    console.error('   2. Use a cloud storage URL approach instead');
    console.error('   3. Remove unnecessary pages or content\n');
    process.exit(1);
  }
  
  // Instructions
  console.log('\n📋 GitHub Secrets Setup Instructions:');
  console.log('─'.repeat(70));
  console.log('1. Go to your GitHub repository');
  console.log('2. Navigate to: Settings → Secrets and variables → Actions');
  console.log('3. Click "New repository secret"');
  console.log('4. Create TWO secrets:\n');
  console.log('   Secret Name #1:  CV_FILE_1_BASE64');
  console.log('   Secret Value #1: [Copy the base64 string below]\n');
  console.log('   Secret Name #2:  CV_FILE_1_EXT');
  console.log(`   Secret Value #2: ${fileExtension}\n`);
  console.log('5. For additional resumes, use CV_FILE_2_BASE64, CV_FILE_3_BASE64, etc.');
  console.log('─'.repeat(70));
  
  console.log('\n📦 Base64 String (Copy everything between the lines):');
  console.log('═'.repeat(70));
  console.log(base64String);
  console.log('═'.repeat(70));
  
  console.log('\n✅ Next Steps:');
  console.log('   • Copy the base64 string above');
  console.log('   • Add it to GitHub Secrets as CV_FILE_1_BASE64');
  console.log(`   • Add file extension to GitHub Secrets as CV_FILE_1_EXT with value: ${fileExtension}`);
  console.log('   • Repeat for additional resume versions (CV_FILE_2_BASE64, etc.)');
  console.log('   • Never commit the actual resume files to git!\n');
  
} catch (error) {
  console.error('❌ Error reading file:', error.message);
  process.exit(1);
}
