declare const window: any;

export const environment = {
  production: false,
  enableMetrics: true,  // Enable metrics collection in dev
  enableLogs: true,     // Enable console logs in dev
  enableOTLP: false,    // Disable OTLP sending in dev (logs stay in console)
  get supabaseUrl(): string {
    return window.env?.SUPABASE_URL || 'https://sibdlmvdhxbtwsujrxrh.supabase.co';
  },
  get supabaseAnonKey(): string {
    return window.env?.SUPABASE_ANON_KEY || '';
  }
};
