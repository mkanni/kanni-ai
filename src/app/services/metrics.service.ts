import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private metrics = new Map<string, number>();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, Array<{ value: number; timestamp: number }>>();

  constructor() {
    if (!environment.enableMetrics) {
      console.log('⚠️  Metrics collection disabled in this environment');
      return;
    }
    
    // Initialize basic metrics
    this.gauges.set('app_start_time', Date.now());
    this.counters.set('page_views_total', 0);
    this.counters.set('user_logins_total', 0);
    this.counters.set('user_logouts_total', 0);
    this.counters.set('interests_created_total', 0);
    this.counters.set('interests_deleted_total', 0);
    this.counters.set('tips_generated_total', 0);
    this.counters.set('errors_total', 0);
    
    console.log(`✅ Metrics service initialized for ${environment.production ? 'production' : 'development'}`);
  }

  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>) {
    if (!environment.enableMetrics) return;
    
    const metricName = this.buildMetricName(name, labels);
    const current = this.counters.get(metricName) || 0;
    this.counters.set(metricName, current + value);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>) {
    if (!environment.enableMetrics) return;
    
    const metricName = this.buildMetricName(name, labels);
    this.gauges.set(metricName, value);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>) {
    if (!environment.enableMetrics) return;
    
    const metricName = this.buildMetricName(name, labels);
    const history = this.histograms.get(metricName) || [];
    history.push({ value, timestamp: Date.now() });
    
    // Keep only last 1000 values to prevent memory issues
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.histograms.set(metricName, history);
  }

  // HTTP-related metrics
  recordHttpRequest(method: string, endpoint: string, statusCode: number, duration: number) {
    // Record HTTP request count - using http_server_request_duration_seconds naming for compatibility
    this.incrementCounter('http_server_request_duration_seconds_count', 1, { 
      http_method: method.toUpperCase(), 
      http_route: this.normalizeEndpoint(endpoint),
      http_status_code: statusCode.toString()
    });

    // Record response time in seconds (convert from ms)
    const durationSeconds = duration / 1000;
    this.recordHistogram('http_server_request_duration_seconds', durationSeconds, { 
      http_method: method.toUpperCase(),
      http_route: this.normalizeEndpoint(endpoint),
      http_status_code: statusCode.toString()
    });

    // Also keep legacy http_requests_total for backwards compatibility
    this.incrementCounter('http_requests_total', 1, { 
      method: method.toUpperCase(), 
      endpoint: this.normalizeEndpoint(endpoint),
      status_code: statusCode.toString()
    });

    // Record error rates
    if (statusCode >= 400) {
      this.incrementCounter('http_errors_total', 1, { 
        method: method.toUpperCase(),
        endpoint: this.normalizeEndpoint(endpoint),
        status_code: statusCode.toString()
      });
    }

    // Update active sessions gauge
    this.setGauge('http_active_sessions', 1);
  }

  recordSupabaseLatency(operation: string, duration: number, success: boolean) {
    this.recordHistogram('supabase_request_duration_ms', duration, { 
      operation: operation,
      success: success.toString()
    });
    
    if (!success) {
      this.incrementCounter('supabase_errors_total', 1, { operation: operation });
    }
  }

  recordSupabaseConnection(connected: boolean) {
    this.setGauge('supabase_connected', connected ? 1 : 0);
  }

  // Business metric methods
  recordPageView(pageName: string) {
    this.incrementCounter('page_views_total', 1, { page: pageName });
    this.recordHttpRequest('GET', `/${pageName}`, 200, 0); // Simulate HTTP request for page view
  }

  recordUserLogin() {
    this.incrementCounter('user_logins_total');
    this.incrementCounter('active_users', 1);
  }

  recordUserLogout() {
    this.incrementCounter('user_logouts_total');
    this.incrementCounter('active_users', -1);
  }

  recordInterestCreated() {
    this.incrementCounter('interests_created_total');
  }

  recordInterestDeleted() {
    this.incrementCounter('interests_deleted_total');
  }

  recordTipGenerated() {
    this.incrementCounter('tips_generated_total');
  }

  recordError(errorType: string = 'unknown') {
    this.incrementCounter('errors_total', 1, { type: errorType });
  }

  recordResponseTime(endpoint: string, duration: number) {
    this.recordHistogram('http_request_duration_ms', duration, { endpoint });
  }

  private normalizeEndpoint(endpoint: string): string {
    // Normalize endpoints to remove IDs and make them consistent
    return endpoint
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\?.*$/, '')
      .toLowerCase();
  }

  // Export metrics in Prometheus format
  exportPrometheusMetrics(): string {
    if (!environment.enableMetrics) {
      return '# Metrics collection disabled\n';
    }
    
    let output = '';
    
    // Add metadata
    const envLabel = environment.production ? 'production' : 'development';
    output += '# HELP app_info Application information\n';
    output += '# TYPE app_info gauge\n';
    output += `app_info{version="1.0.0",service="kanni-ai-frontend",environment="${envLabel}"} 1\n\n`;

    // Export counters
    for (const [name, value] of this.counters.entries()) {
      const cleanName = this.getMetricBaseName(name);
      const labels = this.getMetricLabels(name);
      output += `# HELP ${cleanName} Total count of ${cleanName.replace(/_total$/, '').replace(/_/g, ' ')}\n`;
      output += `# TYPE ${cleanName} counter\n`;
      output += `${cleanName}${labels} ${value}\n\n`;
    }

    // Export gauges
    for (const [name, value] of this.gauges.entries()) {
      const cleanName = this.getMetricBaseName(name);
      const labels = this.getMetricLabels(name);
      output += `# HELP ${cleanName} Current value of ${cleanName.replace(/_/g, ' ')}\n`;
      output += `# TYPE ${cleanName} gauge\n`;
      output += `${cleanName}${labels} ${value}\n\n`;
    }

    // Export histograms with proper bucket format
    const histogramBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    for (const [name, values] of this.histograms.entries()) {
      if (values.length === 0) continue;
      
      const cleanName = this.getMetricBaseName(name);
      const labels = this.getMetricLabels(name);
      
      // For http_server_request_duration_seconds, export as proper histogram
      if (cleanName === 'http_server_request_duration_seconds') {
        const labelStr = labels.slice(1, -1); // Remove { and }
        
        output += `# HELP ${cleanName} HTTP request duration in seconds\n`;
        output += `# TYPE ${cleanName} histogram\n`;
        
        // Calculate buckets
        const sortedValues = values.map(v => v.value).sort((a, b) => a - b);
        for (const bucket of histogramBuckets) {
          const count = sortedValues.filter(v => v <= bucket).length;
          output += `${cleanName}_bucket{${labelStr},le="${bucket}"} ${count}\n`;
        }
        // +Inf bucket
        output += `${cleanName}_bucket{${labelStr},le="+Inf"} ${values.length}\n`;
        
        // Sum and count
        const sum = sortedValues.reduce((acc, v) => acc + v, 0);
        output += `${cleanName}_sum{${labelStr}} ${sum.toFixed(6)}\n`;
        output += `${cleanName}_count{${labelStr}} ${values.length}\n\n`;
      } else {
        // For other histograms, export as simplified gauges
        const recent = values.slice(-100);
        const avg = recent.reduce((sum, v) => sum + v.value, 0) / recent.length;
        const max = Math.max(...recent.map(v => v.value));
        const min = Math.min(...recent.map(v => v.value));
        
        output += `# HELP ${cleanName}_avg Average of ${cleanName.replace(/_/g, ' ')}\n`;
        output += `# TYPE ${cleanName}_avg gauge\n`;
        output += `${cleanName}_avg${labels} ${avg.toFixed(2)}\n\n`;
        
        output += `# HELP ${cleanName}_max Maximum of ${cleanName.replace(/_/g, ' ')}\n`;
        output += `# TYPE ${cleanName}_max gauge\n`;
        output += `${cleanName}_max${labels} ${max}\n\n`;
        
        output += `# HELP ${cleanName}_min Minimum of ${cleanName.replace(/_/g, ' ')}\n`;
        output += `# TYPE ${cleanName}_min gauge\n`;
        output += `${cleanName}_min${labels} ${min}\n\n`;
      }
    }

    // Add uptime
    const uptime = (Date.now() - (this.gauges.get('app_start_time') || Date.now())) / 1000;
    output += '# HELP app_uptime_seconds Application uptime in seconds\n';
    output += '# TYPE app_uptime_seconds gauge\n';
    output += `app_uptime_seconds ${uptime.toFixed(2)}\n\n`;

    return output;
  }

  private buildMetricName(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private getMetricBaseName(name: string): string {
    const braceIndex = name.indexOf('{');
    return braceIndex >= 0 ? name.substring(0, braceIndex) : name;
  }

  private getMetricLabels(name: string): string {
    const braceIndex = name.indexOf('{');
    if (braceIndex >= 0) {
      return name.substring(braceIndex);
    }
    return '';
  }
}