import { Component, OnInit, Inject, Renderer2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MetricsService } from '../services/metrics.service';
import { SupabaseService } from '../services/supabase.service';

@Component({
  selector: 'app-metrics',
  template: '<pre></pre>',
  standalone: false
})
export class MetricsComponent implements OnInit {
  metrics: string = '';

  constructor(
    private metricsService: MetricsService,
    private supabaseService: SupabaseService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  async ngOnInit() {
    // Generate some sample metrics if none exist
    await this.generateSampleMetrics();
    
    // Generate metrics in Prometheus format
    this.metrics = this.metricsService.exportPrometheusMetrics();
    
    // Strip HTML and show only metrics text (like /health endpoint)
    setTimeout(() => {
      // Remove ALL elements including html, head, body
      const html = this.document.documentElement;
      while (html.firstChild) {
        html.removeChild(html.firstChild);
      }
      
      // Create minimal structure with just pre element
      const head = this.renderer.createElement('head');
      const meta = this.renderer.createElement('meta');
      this.renderer.setAttribute(meta, 'charset', 'utf-8');
      this.renderer.appendChild(head, meta);
      
      const body = this.renderer.createElement('body');
      const pre = this.renderer.createElement('pre');
      const text = this.renderer.createText(this.metrics);
      
      this.renderer.appendChild(pre, text);
      this.renderer.setStyle(pre, 'font-family', 'monospace');
      this.renderer.setStyle(pre, 'white-space', 'pre');
      this.renderer.setStyle(pre, 'margin', '0');
      this.renderer.setStyle(pre, 'padding', '0');
      this.renderer.setStyle(body, 'margin', '0');
      this.renderer.setStyle(body, 'padding', '0');
      
      this.renderer.appendChild(body, pre);
      this.renderer.appendChild(html, head);
      this.renderer.appendChild(html, body);
      
      // Set content type (won't work from Angular but good practice)
      const metaContentType = this.renderer.createElement('meta');
      this.renderer.setAttribute(metaContentType, 'http-equiv', 'Content-Type');
      this.renderer.setAttribute(metaContentType, 'content', 'text/plain; charset=utf-8');
      this.renderer.appendChild(head, metaContentType);
    }, 0);
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