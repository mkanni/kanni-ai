const fs = require('fs');
const path = require('path');

// Get parameters from command line arguments
const version = process.argv[2] || '1.0.0';
const commit = process.argv[3] || 'unknown';

console.log('Injecting version info:');
console.log(`  Version: ${version}`);
console.log(`  Commit: ${commit}`);

// Create version info script
const versionScript = `
// Version information injected during GitHub Actions build
window.APP_VERSION = '${version}';
window.APP_COMMIT_HASH = '${commit}';
console.log('Application Version: v${version}' + ('${commit}' !== 'unknown' ? ' (${commit.substring(0, 7)})' : ''));
`;

// Write to assets directory
const assetsDir = path.join(__dirname, '..', 'src', 'assets');
const versionFile = path.join(assetsDir, 'version.js');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

fs.writeFileSync(versionFile, versionScript);

console.log(`✅ Version file created: ${versionFile}`);