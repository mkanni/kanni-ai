import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

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

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.supabaseService.initialize();
    
    // Check if user is already logged in
    const session = await this.supabaseService.getSession();
    if (session) {
      console.log('User already logged in, redirecting to home');
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
        const { error } = await this.supabaseService.signUp(this.email, this.password);
        if (error) {
          this.errorMessage = error.message;
        } else {
          this.successMessage = 'Account created! Please check your email to verify your account.';
          this.email = '';
          this.password = '';
          this.confirmPassword = '';
        }
      } else {
        const { error } = await this.supabaseService.signIn(this.email, this.password);
        if (error) {
          this.errorMessage = error.message;
          console.error('Login error:', error);
        } else {
          console.log('Login successful, navigating to home');
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
        this.loading = false;
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
        this.loading = false;
      }
      // Loading will be cleared after redirect
    } catch (error: any) {
      console.error('GitHub OAuth exception:', error);
      this.errorMessage = error.message || 'An error occurred during GitHub sign-in';
      this.loading = false;
    }
  }
}
