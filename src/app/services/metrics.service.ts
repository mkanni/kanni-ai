import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class MetricsService {
  private metrics = new Map<string, number>();
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, Array<{ value: number; timestamp: number }>>();

  constructor() {
    // Initialize basic metrics
    this.gauges.set('app_start_time', Date.now());
    this.counters.set('page_views_total', 0);
    this.counters.set('user_logins_total', 0);
    this.counters.set('user_logouts_total', 0);
    this.counters.set('interests_created_total', 0);
    this.counters.set('interests_deleted_total', 0);
    this.counters.set('tips_generated_total', 0);
    this.counters.set('errors_total', 0);
  }

  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>) {
    const metricName = this.buildMetricName(name, labels);
    const current = this.counters.get(metricName) || 0;
    this.counters.set(metricName, current + value);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>) {
    const metricName = this.buildMetricName(name, labels);
    this.gauges.set(metricName, value);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>) {
    const metricName = this.buildMetricName(name, labels);
    const history = this.histograms.get(metricName) || [];
    history.push({ value, timestamp: Date.now() });
    
    // Keep only last 1000 values to prevent memory issues
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    this.histograms.set(metricName, history);
  }

  // Business metric methods
  recordPageView(pageName: string) {
    this.incrementCounter('page_views_total', 1, { page: pageName });
  }

  recordUserLogin() {
    this.incrementCounter('user_logins_total');
  }

  recordUserLogout() {
    this.incrementCounter('user_logouts_total');
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

  // Export metrics in Prometheus format
  exportPrometheusMetrics(): string {
    let output = '';
    
    // Add metadata
    output += '# HELP app_info Application information\n';
    output += '# TYPE app_info gauge\n';
    output += `app_info{version="1.0.0",service="kanni-ai-frontend"} 1\n\n`;

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

    // Export histograms (simplified as gauges for now)
    for (const [name, values] of this.histograms.entries()) {
      if (values.length === 0) continue;
      
      const cleanName = this.getMetricBaseName(name);
      const labels = this.getMetricLabels(name);
      const recent = values.slice(-100); // Last 100 values
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