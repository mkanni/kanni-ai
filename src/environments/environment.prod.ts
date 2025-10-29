declare const window: any;

export const environment = {
  production: true,
  enableMetrics: true,  // Enable metrics collection in production
  enableLogs: true,     // Enable logs in production
  enableOTLP: true,     // Enable OTLP sending in production
  get supabaseUrl(): string {
    return window.env?.SUPABASE_URL || 'https://sibdlmvdhxbtwsujrxrh.supabase.co';
  },
  get supabaseAnonKey(): string {
    return window.env?.SUPABASE_ANON_KEY || '';
  }
};
