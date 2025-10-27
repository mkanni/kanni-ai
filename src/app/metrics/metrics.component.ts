import { Component, OnInit } from '@angular/core';
import { MetricsService } from '../services/metrics.service';
import { SupabaseService } from '../services/supabase.service';

@Component({
  selector: 'app-metrics',
  template: '<pre [innerHTML]="metrics"></pre>',
  standalone: false
})
export class MetricsComponent implements OnInit {
  metrics: string = '';

  constructor(
    private metricsService: MetricsService,
    private supabaseService: SupabaseService
  ) {}

  async ngOnInit() {
    // Generate some sample metrics if none exist
    await this.generateSampleMetrics();
    
    // Generate metrics in Prometheus format
    this.metrics = this.metricsService.exportPrometheusMetrics();
  }

  private async generateSampleMetrics() {
    // Test Supabase connectivity and record metrics
    const startTime = Date.now();
    try {
      await this.supabaseService.getSession();
      const duration = Date.now() - startTime;
      this.metricsService.recordSupabaseLatency('health_check', duration, true);
      this.metricsService.recordSupabaseConnection(true);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metricsService.recordSupabaseLatency('health_check', duration, false);
      this.metricsService.recordSupabaseConnection(false);
    }

    // Record some sample application metrics
    this.metricsService.recordHttpRequest('GET', '/health', 200, 25);
    this.metricsService.recordHttpRequest('GET', '/metrics', 200, 15);
    
    // Add some error examples for demonstration
    if (Math.random() > 0.9) {
      this.metricsService.recordHttpRequest('GET', '/api/tips', 500, 1000);
    }
  }
}