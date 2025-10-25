import { Injectable } from '@angular/core';
import { trace, metrics } from '@opentelemetry/api';

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private tracer = trace.getTracer('kanni-ai-frontend');
  private meter = metrics.getMeter('kanni-ai-frontend');

  constructor() {
    this.initializeOpenTelemetry();
  }

  private initializeOpenTelemetry() {
    // For now, we'll use a basic implementation
    // The full OpenTelemetry setup will be done in main.ts
    console.log('OpenTelemetry service initialized');
  }

  createSpan(name: string, attributes?: Record<string, any>) {
    return this.tracer.startSpan(name, { attributes });
  }

  recordMetric(name: string, value: number, attributes?: Record<string, any>) {
    const counter = this.meter.createCounter(name);
    counter.add(value, attributes);
  }

  recordPageView(pageName: string) {
    const span = this.createSpan('page_view', {
      'page.name': pageName,
      'page.url': window.location.href,
      'user.agent': navigator.userAgent
    });
    span.end();
  }

  recordError(error: Error, context?: string) {
    const span = this.createSpan('error', {
      'error.message': error.message,
      'error.stack': error.stack,
      'error.context': context || 'unknown'
    });
    span.recordException(error);
    span.end();
  }

  recordUserAction(action: string, details?: Record<string, any>) {
    const span = this.createSpan('user_action', {
      'action.name': action,
      ...details
    });
    span.end();
  }
}