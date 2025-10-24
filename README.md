# AI Learning Assistant

An Angular-based AI learning assistant with Supabase authentication and serverless Edge Functions.

## Features

- 🤖 **AI-Powered Learning Tips** - Personalized learning suggestions via OpenAI GPT-3.5
- 🔐 **Supabase Authentication** - Email/password and social logins (Google, GitHub)
- 🎨 **Modern UI** - Material Design with neural network visualization
- ⚡ **Serverless Architecture** - Supabase Edge Functions (no backend server needed)
- 📱 **Responsive Design** - Works on all devices

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment** in `src/assets/env.js`:
   ```javascript
   window.env = {
     "SUPABASE_URL": "your-supabase-url",
     "SUPABASE_ANON_KEY": "your-supabase-anon-key",
     "USERNAME": "Your Name",
     "INTERESTS": "software development, AI, cooking, etc."
   };
   ```

3. **Deploy Edge Function** to Supabase:
   - Go to your Supabase Dashboard → Edge Functions
   - Create new function named `generate-tip`
   - Copy code from `supabase/functions/generate-tip/index.ts`
   - Add secret: `OPENAI_API_KEY`

4. **Run the app:**
   ```bash
   npm start
   ```

5. **Open in browser:**
   - http://localhost:4200

## Project Structure

```
src/
├── app/
│   ├── login/              # Login/signup component
│   ├── services/
│   │   ├── openai.service.ts    # Calls Edge Function
│   │   └── supabase.service.ts  # Auth management
│   └── guards/
│       └── auth.guard.ts        # Route protection
├── assets/
│   └── env.js                   # Environment config
└── environments/                # Environment settings

supabase/
└── functions/
    └── generate-tip/            # Serverless OpenAI proxy
```

## Deployment

This is a static Angular app. Deploy to any hosting:

- **Vercel**: `vercel deploy`
- **Netlify**: `netlify deploy`  
- **GitHub Pages**: `ng build --configuration production && gh-pages -d dist`
- **Any CDN**: Upload `dist/kanni-poc` after build

## Tech Stack

- Angular 16
- Supabase (Auth + Edge Functions)
- OpenAI GPT-3.5
- Angular Material
- TypeScript
