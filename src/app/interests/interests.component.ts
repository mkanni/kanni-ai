import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { TelemetryService } from '../services/telemetry.service';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-interests',
  templateUrl: './interests.component.html',
  styleUrls: ['./interests.component.scss']
})
export class InterestsComponent implements OnInit {
  currentUser: User | null = null;
  username: string = '';
  interests: string[] = [];
  newInterest: string = '';
  isLoading: boolean = false;
  isSaving: boolean = false;

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private telemetryService: TelemetryService
  ) {}

  ngOnInit(): void {
    this.supabaseService.user$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        // Record page view with user information
        this.telemetryService.recordPageView('interests', user);
        
        // Extract name from email or use email
        const emailName = user.email?.split('@')[0] || 'User';
        // Capitalize first letter
        this.username = this.capitalizeFirstLetter(user.user_metadata?.['full_name'] || user.user_metadata?.['name'] || emailName);
        this.loadUserInterests();
      }
    });
  }

  capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }



  async loadUserInterests(): Promise<void> {
    if (!this.currentUser) return;

    this.isLoading = true;
    try {
      const userInterests = await this.supabaseService.getUserInterests();
      this.interests = userInterests.map((interest: { id: string; name: string; created_at: string }) => interest.name);
      

    } catch (error) {
      console.error('Error loading interests:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async addInterest(): Promise<void> {
    if (!this.newInterest.trim() || !this.currentUser) return;

    const interest = this.newInterest.trim();
    if (this.interests.includes(interest)) {
      alert('This interest already exists!');
      return;
    }

    this.isSaving = true;
    try {
      await this.supabaseService.addUserInterest(interest);
      this.interests.push(interest);
      this.telemetryService.logInterestCreated({ name: interest, id: 'new' }, this.currentUser);
      this.newInterest = '';
      

    } catch (error) {
      console.error('Error adding interest:', error);
      this.telemetryService.logError('Failed to add interest', error as Error, {
        'interest.name': interest,
        'user.id': this.currentUser?.id || 'unknown',
        'user.email': this.currentUser?.email || 'unknown'
      });
      alert('Failed to add interest. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  async removeInterest(interest: string): Promise<void> {
    if (!this.currentUser) return;

    this.isSaving = true;
    try {
      await this.supabaseService.removeUserInterest(interest);
      this.interests = this.interests.filter(i => i !== interest);
      this.telemetryService.logInterestDeleted(interest, this.currentUser);
      

    } catch (error) {
      console.error('Error removing interest:', error);
      this.telemetryService.logError('Failed to remove interest', error as Error, {
        'interest.name': interest,
        'user.id': this.currentUser?.id || 'unknown',
        'user.email': this.currentUser?.email || 'unknown'
      });
      alert('Failed to remove interest. Please try again.');
    } finally {
      this.isSaving = false;
    }
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}