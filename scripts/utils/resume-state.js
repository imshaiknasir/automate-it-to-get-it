const path = require('node:path');
const fs = require('fs').promises;

const STATE_FILE = path.resolve(__dirname, '..', '..', 'resume-state.json');
const RESUMES_DIR = path.resolve(__dirname, '..', '..', 'resumes');

/**
 * Reads the current resume state from the state file.
 * @returns {Promise<{lastUsedIndex: number}>} The state object
 */
async function readState() {
	try {
		const content = await fs.readFile(STATE_FILE, 'utf-8');
		return JSON.parse(content);
	} catch (error) {
		// If file doesn't exist or is invalid, return default state
		return { lastUsedIndex: 0 };
	}
}

/**
 * Writes the resume state to the state file.
 * @param {Object} state - The state object to save
 */
async function writeState(state) {
	await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Gets the next resume index (alternates between 1 and 2).
 * Also updates the state file with the new index.
 * @returns {Promise<number>} The next resume index (1 or 2)
 */
async function getNextResumeIndex() {
	const state = await readState();
	// Alternate: if last was 0 or 2, use 1; if last was 1, use 2
	const nextIndex = state.lastUsedIndex === 1 ? 2 : 1;
	await writeState({ lastUsedIndex: nextIndex, lastUpdated: new Date().toISOString() });
	return nextIndex;
}

/**
 * Gets the resume file path for the given index.
 * Supports both environment variable paths and default resumes directory.
 * @param {number} index - Resume index (1 or 2)
 * @returns {Promise<{path: string, name: string} | null>} Resume file info or null if not found
 */
async function getResumePath(index) {
	// First check environment variable
	const envPath = process.env[`RESUME_PATH_${index}`];
	
	if (envPath) {
		const resolvedPath = path.isAbsolute(envPath) 
			? envPath 
			: path.resolve(__dirname, '..', '..', envPath);
		
		try {
			await fs.access(resolvedPath);
			return {
				path: resolvedPath,
				name: path.basename(resolvedPath),
			};
		} catch {
			// File doesn't exist at env path
			return null;
		}
	}
	
	// Check for base64 encoded resume (for GitHub Actions)
	const base64Content = process.env[`CV_FILE_${index}_BASE64`];
	const fileExt = process.env[`CV_FILE_${index}_EXT`] || 'pdf';
	
	if (base64Content) {
		// Decode and save to temp location
		const tempDir = path.resolve(__dirname, '..', '..', 'temp-cvs');
		await fs.mkdir(tempDir, { recursive: true });
		
		const tempPath = path.join(tempDir, `resume-${index}.${fileExt}`);
		const buffer = Buffer.from(base64Content, 'base64');
		await fs.writeFile(tempPath, buffer);
		
		return {
			path: tempPath,
			name: `resume-${index}.${fileExt}`,
		};
	}
	
	// Fallback: check default resumes directory
	const defaultFiles = [`resume${index}.pdf`, `resume${index}.docx`, `resume-${index}.pdf`, `resume-${index}.docx`];
	
	for (const fileName of defaultFiles) {
		const filePath = path.join(RESUMES_DIR, fileName);
		try {
			await fs.access(filePath);
			return {
				path: filePath,
				name: fileName,
			};
		} catch {
			// File doesn't exist, try next
		}
	}
	
	return null;
}

/**
 * Gets the next resume to use, alternating between the two.
 * @returns {Promise<{index: number, path: string, name: string} | null>} Resume info or null if none available
 */
async function getNextResume() {
	const index = await getNextResumeIndex();
	const resume = await getResumePath(index);
	
	if (resume) {
		return {
			index,
			...resume,
		};
	}
	
	// If the alternated resume doesn't exist, try the other one
	const fallbackIndex = index === 1 ? 2 : 1;
	const fallbackResume = await getResumePath(fallbackIndex);
	
	if (fallbackResume) {
		// Update state to reflect actual resume used
		await writeState({ lastUsedIndex: fallbackIndex, lastUpdated: new Date().toISOString() });
		return {
			index: fallbackIndex,
			...fallbackResume,
		};
	}
	
	return null;
}

/**
 * Cleans up temporary CV files after upload.
 */
async function cleanupTempResumes() {
	const tempDir = path.resolve(__dirname, '..', '..', 'temp-cvs');
	try {
		const files = await fs.readdir(tempDir);
		for (const file of files) {
			await fs.unlink(path.join(tempDir, file));
		}
		await fs.rmdir(tempDir);
	} catch {
		// Directory may not exist, ignore
	}
}

module.exports = {
	getNextResume,
	getResumePath,
	getNextResumeIndex,
	cleanupTempResumes,
	RESUMES_DIR,
	STATE_FILE,
};
