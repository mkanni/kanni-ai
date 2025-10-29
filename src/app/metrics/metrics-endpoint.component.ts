import { Component, OnInit, Inject, Renderer2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { MetricsService } from '../services/metrics.service';

@Component({
  selector: 'app-metrics-endpoint',
  template: '<pre style="font-family: monospace; white-space: pre-wrap;"></pre>'
})
export class MetricsEndpointComponent implements OnInit {
  constructor(
    private metricsService: MetricsService,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    // Wait for Angular to finish rendering, then replace the page content
    setTimeout(() => {
      const metrics = this.metricsService.exportPrometheusMetrics();
      
      // Clear everything and just show the metrics
      while (this.document.body.firstChild) {
        this.document.body.removeChild(this.document.body.firstChild);
      }
      
      const pre = this.renderer.createElement('pre');
      const text = this.renderer.createText(metrics);
      this.renderer.appendChild(pre, text);
      this.renderer.setStyle(pre, 'font-family', 'monospace');
      this.renderer.setStyle(pre, 'white-space', 'pre-wrap');
      this.renderer.setStyle(pre, 'margin', '0');
      this.renderer.setStyle(pre, 'padding', '0');
      this.renderer.appendChild(this.document.body, pre);
    }, 0);
  }
}
