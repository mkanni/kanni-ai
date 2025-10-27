const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;

// Get commit hash from git
let commitHash = 'unknown';
try {
  commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
  console.warn('Could not get git commit hash:', error.message);
}

// Create version info script
const versionScript = `
// Version information injected during build
window.APP_VERSION = '${version}';
window.APP_COMMIT_HASH = '${commitHash}';
console.log('Application Version: v${version}' + ('${commitHash}' !== 'unknown' ? ' (${commitHash.substring(0, 6)})' : ''));
`;

// Write to assets directory
const assetsDir = path.join(__dirname, '..', 'src', 'assets');
const versionFile = path.join(assetsDir, 'version.js');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(versionFile, versionScript);

console.log('✅ Version info generated:');
console.log(`   Version: v${version}`);
console.log(`   Commit: ${commitHash.substring(0, 6)}`);
console.log(`   File: ${versionFile}`);