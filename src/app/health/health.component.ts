import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';

interface HealthResponse {
  statusCode: number;
  message: string;
  timestamp: string;
  supabase: {
    status: string;
    connected: boolean;
    duration: number;
  };
}

@Component({
  selector: 'app-health',
  template: `
    <div style="background: #1a1a1a; color: #00ff00; font-family: 'Courier New', monospace; padding: 20px; min-height: 100vh;">
      <pre style="white-space: pre-wrap; word-wrap: break-word;">{{ healthData | json }}</pre>
    </div>
  `,
  styles: []
})
export class HealthComponent implements OnInit {
  healthData: HealthResponse | null = null;

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit() {
    const startTime = performance.now();
    
    try {
      // Test Supabase connection by checking session
      const { data, error } = await this.supabaseService.getClient().auth.getSession();
      const endTime = performance.now();
      const duration = Math.round((endTime - startTime) * 100) / 100; // Round to 2 decimals

      this.healthData = {
        statusCode: error ? 503 : 200,
        message: error ? 'Service degraded - Supabase connection failed' : 'Service is healthy',
        timestamp: new Date().toISOString(),
        supabase: {
          status: error ? 'disconnected' : 'connected',
          connected: !error,
          duration: duration
        }
      };
    } catch (err) {
      const endTime = performance.now();
      const duration = Math.round((endTime - startTime) * 100) / 100;

      this.healthData = {
        statusCode: 503,
        message: 'Service unavailable - Supabase connection error',
        timestamp: new Date().toISOString(),
        supabase: {
          status: 'error',
          connected: false,
          duration: duration
        }
      };
    }
  }
}
