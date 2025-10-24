declare global {
  interface Window {
    env?: {
      OPENAI_API_KEY?: string;
      USERNAME?: string;
      INTERESTS?: string;
    };
  }
}

export {};
