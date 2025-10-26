declare global {
  interface Window {
    env?: {
      OPENAI_API_KEY?: string;
      USERNAME?: string;
      INTERESTS?: string;
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    };
  }
}

export {};
