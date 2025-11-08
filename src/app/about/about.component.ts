import { Component, OnInit } from '@angular/core';
import { TelemetryService } from '../services/telemetry.service';
import { SupabaseService } from '../services/supabase.service';
import { User } from '@supabase/supabase-js';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  currentUser: User | null = null;

  constructor(
    private telemetryService: TelemetryService,
    private supabaseService: SupabaseService
  ) { }

  ngOnInit(): void {
    // Subscribe to user and record page view with user info
    this.supabaseService.user$.subscribe(user => {
      this.currentUser = user;
      this.telemetryService.recordPageView('about', user);
    });
  }

  getEnvironment(): string {
    if (window.location.hostname === 'kanni-ai.de') {
      return 'Production';
    } else if (window.location.hostname.includes('kanni-ai')) {
      return 'Staging';
    }
    return 'Development';
  }
}