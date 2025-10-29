import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';

interface HealthResponse {
  statusCode: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: string;
  duration: number;
  version: string;
  application: {
    status: 'healthy' | 'unhealthy';
    uptime: number;
  };
  supabase: {
    status: 'healthy' | 'unhealthy';
    connected: boolean;
    latency: number;
    error?: string;
  };
}

@Component({
  selector: 'app-health',
  template: '',
  styles: []
})
export class HealthComponent implements OnInit {
  healthData: HealthResponse | null = null;
  healthJson: string = '';
  private startTime = Date.now();

  constructor(private supabaseService: SupabaseService) {}

  async ngOnInit() {
    const checkStart = performance.now();
    
    try {
      // Test Supabase connection by checking session
      const { data, error } = await this.supabaseService.getClient().auth.getSession();
      const checkEnd = performance.now();
      const supabaseLatency = Math.round((checkEnd - checkStart) * 100) / 100;

      const overallDuration = Math.round((performance.now() - checkStart) * 100) / 100;
      const supabaseHealthy = !error;
      const overallStatus = supabaseHealthy ? 'healthy' : 'degraded';
      const statusCode = supabaseHealthy ? 200 : 206;

      this.healthData = {
        statusCode,
        status: overallStatus,
        message: supabaseHealthy ? 'Service is healthy' : 'Service is degraded - Supabase connection issues',
        timestamp: new Date().toISOString(),
        duration: overallDuration,
        version: this.getVersion(),
        application: {
          status: 'healthy',
          uptime: Date.now() - this.startTime
        },
        supabase: {
          status: supabaseHealthy ? 'healthy' : 'unhealthy',
          connected: supabaseHealthy,
          latency: supabaseLatency,
          error: error?.message
        }
      };
    } catch (err: any) {
      const checkEnd = performance.now();
      const supabaseLatency = Math.round((checkEnd - checkStart) * 100) / 100;
      const overallDuration = Math.round((performance.now() - checkStart) * 100) / 100;

      this.healthData = {
        statusCode: 503,
        status: 'unhealthy',
        message: 'Service unavailable - Critical error',
        timestamp: new Date().toISOString(),
        duration: overallDuration,
        version: this.getVersion(),
        application: {
          status: 'healthy',
          uptime: Date.now() - this.startTime
        },
        supabase: {
          status: 'unhealthy',
          connected: false,
          latency: supabaseLatency,
          error: err?.message || 'Connection failed'
        }
      };
    }

    // Return pure JSON by writing to document
    document.open();
    document.write(JSON.stringify(this.healthData, null, 2));
    document.close();
    
    // Set content type header
    if (document.contentType) {
      (document as any).contentType = 'application/json';
    }
  }

  private getVersion(): string {
    // Format: "v 1.0.0(d73hf9a)" or "v 1.0.0" if no commit
    const version = (window as any).APP_VERSION || '1.0.0';
    const commit = (window as any).APP_COMMIT_HASH;
    const shortCommit = commit && commit !== 'unknown' ? commit.substring(0, 7) : null;
    
    return `v ${version}${shortCommit ? `(${shortCommit})` : ''}`;
  }


}
