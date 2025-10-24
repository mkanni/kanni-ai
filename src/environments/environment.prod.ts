declare const window: any;

export const environment = {
  production: true,
  get supabaseUrl(): string {
    return window.env?.SUPABASE_URL || 'https://sibdlmvdhxbtwsujrxrh.supabase.co';
  },
  get supabaseAnonKey(): string {
    return window.env?.SUPABASE_ANON_KEY || '';
  }
};
