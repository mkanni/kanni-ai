import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase!: SupabaseClient;
  private currentUser = new BehaviorSubject<User | null>(null);
  private initialized = false;

  constructor(private http: HttpClient) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Get Supabase credentials from environment
      console.log('Window env object:', (window as any).env);
      const supabaseUrl = (window as any).env?.SUPABASE_URL || '';
      const supabaseAnonKey = (window as any).env?.SUPABASE_ANON_KEY || '';

      console.log('Supabase URL:', supabaseUrl);
      console.log('Supabase Anon Key present:', !!supabaseAnonKey);

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Supabase credentials not configured in environment');
        console.error('URL:', supabaseUrl, 'Key:', supabaseAnonKey);
        throw new Error('Supabase credentials missing');
      }

      console.log('Creating Supabase client...');
      this.supabase = createClient(supabaseUrl, supabaseAnonKey);
      console.log('Supabase client created successfully');
      
      // Check active session
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session?.user) {
        this.currentUser.next(session.user);
      }

      // Listen for auth state changes
      this.supabase.auth.onAuthStateChange((_event, session) => {
        this.currentUser.next(session?.user ?? null);
      });

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Supabase:', error);
    }
  }

  get user$(): Observable<User | null> {
    return this.currentUser.asObservable();
  }

  get user(): User | null {
    return this.currentUser.value;
  }

  async signUp(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password
    });
    return { user: data.user, error };
  }

  async signIn(email: string, password: string): Promise<{ user: User | null; error: AuthError | null }> {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return { user: null, error: { message: 'Supabase client not initialized' } as AuthError };
    }
    
    console.log('Attempting sign in...');
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (data.user) {
      console.log('Sign in successful, updating current user:', data.user.email);
      this.currentUser.next(data.user);
    }
    
    if (error) {
      console.error('Sign in error:', error);
    }
    
    return { user: data.user, error };
  }

  async signInWithGoogle(): Promise<{ error: AuthError | null }> {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return { error: { message: 'Supabase client not initialized' } as AuthError };
    }
    
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/home`
      }
    });
    return { error };
  }

  async signInWithGithub(): Promise<{ error: AuthError | null }> {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return { error: { message: 'Supabase client not initialized' } as AuthError };
    }
    
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/home`
      }
    });
    return { error };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.signOut();
    if (!error) {
      this.currentUser.next(null);
    }
    return { error };
  }

  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return { error };
  }

  async getSession(): Promise<Session | null> {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }
    
    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
