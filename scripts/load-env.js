const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env');
const envJsFile = path.join(__dirname, '..', 'src', 'assets', 'env.js');

if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });

  const jsContent = `window.env = ${JSON.stringify(envVars, null, 2)};`;
  
  const assetsDir = path.dirname(envJsFile);
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  
  fs.writeFileSync(envJsFile, jsContent);
  console.log('Environment variables loaded successfully');
} else {
  console.error('.env file not found');
}
