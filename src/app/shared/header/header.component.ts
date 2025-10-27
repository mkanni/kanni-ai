import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { TelemetryService } from '../../services/telemetry.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  currentUser: any = null;
  username: string = '';

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private telemetryService: TelemetryService
  ) {}

  async ngOnInit() {
    // Get current user
    this.currentUser = this.supabaseService.user;
    
    // Set username
    if (this.currentUser?.user_metadata?.full_name) {
      this.username = this.currentUser.user_metadata.full_name;
    } else if (this.currentUser?.email) {
      this.username = this.currentUser.email.split('@')[0];
    }
  }

  getUserInitials(): string {
    if (this.username) {
      return this.username.charAt(0).toUpperCase();
    }
    return 'U';
  }

  async logout() {
    try {
      this.telemetryService.logInfo('User initiated logout', {
        'user.id': this.currentUser?.id || 'unknown',
        'user.email': this.currentUser?.email || 'unknown',
        'auth.action': 'logout_initiated'
      });
      
      await this.supabaseService.signOut();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error logging out:', error);
      this.telemetryService.logError('Logout process failed', error as Error, {
        'user.id': this.currentUser?.id || 'unknown',
        'user.email': this.currentUser?.email || 'unknown',
        'auth.action': 'logout_failed'
      });
    }
  }
}