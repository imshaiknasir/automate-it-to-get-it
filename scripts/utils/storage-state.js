const path = require('node:path');
const fs = require('node:fs/promises');

const STORAGE_DIR = path.resolve(__dirname, '..', '..', 'storage-states');
const STORAGE_FILE = path.join(STORAGE_DIR, 'naukri-login.json');

async function ensureStorageDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

async function storageStateExists() {
  try {
    await fs.access(STORAGE_FILE);
    return true;
  } catch (error) {
    return false;
  }
}

async function loadStorageStatePath() {
  const exists = await storageStateExists();
  return exists ? STORAGE_FILE : undefined;
}

async function saveStorageState(context) {
  await ensureStorageDir();
  await context.storageState({ path: STORAGE_FILE });
}

module.exports = {
  STORAGE_DIR,
  STORAGE_FILE,
  ensureStorageDir,
  storageStateExists,
  loadStorageStatePath,
  saveStorageState,
};
