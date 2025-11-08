import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { TelemetryService } from '../services/telemetry.service';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  isSignUp = false;
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  loading = false;
  currentUser: User | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private telemetryService: TelemetryService
  ) {}

  async ngOnInit() {
    await this.supabaseService.initialize();
    
    // Subscribe to user and record page view with user info
    this.supabaseService.user$.subscribe(user => {
      this.currentUser = user;
      this.telemetryService.recordPageView('login', user);
    });
    
    // Check if user is already logged in
    const session = await this.supabaseService.getSession();
    if (session) {
      console.log('User already logged in, redirecting to home');
      this.telemetryService.logInfo('User already authenticated, redirecting', {
        'user.id': session.user?.id || 'unknown',
        'auth.type': 'existing_session',
        'redirect.destination': '/home'
      });
      this.router.navigate(['/home']);
    }
  }

  toggleMode() {
    this.isSignUp = !this.isSignUp;
    this.clearMessages();
    this.password = '';
    this.confirmPassword = '';
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  async handleEmailAuth() {
    this.clearMessages();

    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter email and password';
      return;
    }

    if (this.isSignUp && this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    if (this.isSignUp && this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      return;
    }

    this.loading = true;

    try {
      if (this.isSignUp) {
        const { error, user } = await this.supabaseService.signUp(this.email, this.password);
        if (error) {
          this.errorMessage = error.message;
          this.telemetryService.logError('User signup failed', error, {
            'auth.method': 'email',
            'auth.action': 'signup',
            'user.email': this.email
          });
        } else {
          this.successMessage = 'Account created! Please check your email to verify your account.';
          this.telemetryService.logInfo('User signup successful', {
            'user.id': user?.id || 'unknown',
            'user.email': this.email,
            'auth.method': 'email',
            'auth.action': 'signup'
          });
          this.email = '';
          this.password = '';
          this.confirmPassword = '';
        }
      } else {
        const { error, user } = await this.supabaseService.signIn(this.email, this.password);
        if (error) {
          this.errorMessage = error.message;
          console.error('Login error:', error);
          this.telemetryService.logError('User login failed', error, {
            'auth.method': 'email',
            'auth.action': 'signin',
            'user.email': this.email
          });
        } else {
          console.log('Login successful, navigating to home');
          this.telemetryService.logUserLogin(user, 'email');
          this.router.navigate(['/home']);
        }
      }
    } catch (error: any) {
      this.errorMessage = error.message || 'An error occurred';
    } finally {
      this.loading = false;
    }
  }

  async handleGoogleLogin() {
    this.clearMessages();
    this.loading = true;

    try {
      console.log('Initiating Google OAuth...');
      const { error } = await this.supabaseService.signInWithGoogle();
      if (error) {
        console.error('Google OAuth error:', error);
        this.errorMessage = `Google sign-in failed: ${error.message}`;
        this.telemetryService.logError('Google OAuth login failed', error, {
          'auth.method': 'google',
          'auth.action': 'oauth_signin'
        });
        this.loading = false;
      } else {
        this.telemetryService.logInfo('Google OAuth login initiated', {
          'auth.method': 'google',
          'auth.action': 'oauth_signin'
        });
      }
      // Loading will be cleared after redirect
    } catch (error: any) {
      console.error('Google OAuth exception:', error);
      this.errorMessage = error.message || 'An error occurred during Google sign-in';
      this.loading = false;
    }
  }

  async handleGithubLogin() {
    this.clearMessages();
    this.loading = true;

    try {
      console.log('Initiating GitHub OAuth...');
      const { error } = await this.supabaseService.signInWithGithub();
      if (error) {
        console.error('GitHub OAuth error:', error);
        this.errorMessage = `GitHub sign-in failed: ${error.message}`;
        this.telemetryService.logError('GitHub OAuth login failed', error, {
          'auth.method': 'github',
          'auth.action': 'oauth_signin'
        });
        this.loading = false;
      } else {
        this.telemetryService.logInfo('GitHub OAuth login initiated', {
          'auth.method': 'github',
          'auth.action': 'oauth_signin'
        });
      }
      // Loading will be cleared after redirect
    } catch (error: any) {
      console.error('GitHub OAuth exception:', error);
      this.errorMessage = error.message || 'An error occurred during GitHub sign-in';
      this.loading = false;
    }
  }
}
