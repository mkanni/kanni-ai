import { Component, OnInit } from '@angular/core';
import { MetricsService } from '../services/metrics.service';

@Component({
  selector: 'app-metrics',
  template: '<pre [innerHTML]="metrics"></pre>',
  standalone: false
})
export class MetricsComponent implements OnInit {
  metrics: string = '';

  constructor(private metricsService: MetricsService) {}

  ngOnInit() {
    // Generate metrics in Prometheus format
    this.metrics = this.metricsService.exportPrometheusMetrics();
  }
}