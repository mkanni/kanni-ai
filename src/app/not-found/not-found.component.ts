import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TelemetryService } from '../services/telemetry.service';
import { SupabaseService } from '../services/supabase.service';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-not-found',
  templateUrl: './not-found.component.html',
  styleUrls: ['./not-found.component.scss']
})
export class NotFoundComponent implements OnInit {
  currentUser: User | null = null;
  attemptedUrl: string = '';

  constructor(
    private router: Router,
    private telemetryService: TelemetryService,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit(): void {
    // Get the attempted URL
    this.attemptedUrl = window.location.pathname;

    // Subscribe to user and record 404 error with user info
    this.supabaseService.user$.subscribe(user => {
      this.currentUser = user;
      this.telemetryService.log404Error(this.attemptedUrl, user);
    });
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
