const fs = require('fs');
const path = require('path');

// Load environment variables from .env file if it exists (for local development)
try {
  require('dotenv').config();
} catch (error) {
  // dotenv might not be available in production builds, that's okay
  console.log('dotenv not available, using environment variables directly');
}

const envConfig = {
  INTERESTS: process.env.INTERESTS || '',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
};

console.log('Environment variables loaded:');
console.log('INTERESTS:', envConfig.INTERESTS ? 'SET' : 'MISSING');
console.log('SUPABASE_URL:', envConfig.SUPABASE_URL ? 'SET' : 'MISSING');
console.log('SUPABASE_ANON_KEY:', envConfig.SUPABASE_ANON_KEY ? 'SET' : 'MISSING');

// Validate required environment variables
if (!envConfig.SUPABASE_URL || !envConfig.SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  process.exit(1);
}

// Generate the env.js content
const envJsContent = `window.env = ${JSON.stringify(envConfig, null, 2)};`;

// Ensure the assets directory exists
const assetsDir = path.join(__dirname, '..', 'src', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Write the env.js file
const envJsPath = path.join(assetsDir, 'env.js');
fs.writeFileSync(envJsPath, envJsContent);

console.log('✅ Generated env.js with environment variables');
console.log(`📍 SUPABASE_URL: ${envConfig.SUPABASE_URL}`);
console.log(`🔑 SUPABASE_ANON_KEY: ${envConfig.SUPABASE_ANON_KEY ? '[SET]' : '[MISSING]'}`);