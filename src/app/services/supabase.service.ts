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
      const supabaseUrl = (window as any).env?.SUPABASE_URL || '';
      const supabaseAnonKey = (window as any).env?.SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error('Supabase credentials not configured in environment');
        return;
      }

      this.supabase = createClient(supabaseUrl, supabaseAnonKey);
      
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
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/home`
      }
    });
    return { error };
  }

  async signInWithGithub(): Promise<{ error: AuthError | null }> {
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
    const { data: { session } } = await this.supabase.auth.getSession();
    return session;
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
