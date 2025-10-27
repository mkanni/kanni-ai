import { Injectable } from '@angular/core';
import { metrics } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { MetricsService } from './metrics.service';

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private meter = metrics.getMeter('kanni-ai-frontend');
  private logger = logs.getLogger('kanni-ai-frontend');
  private initialized = false;

  constructor(private metricsService: MetricsService) {
    this.initializeOpenTelemetry();
  }

  private initializeOpenTelemetry() {
    // For now, we'll use a basic implementation
    // The full OpenTelemetry setup will be done in main.ts
    console.log('OpenTelemetry service initialized');
  }

  recordMetric(name: string, value: number, attributes?: Record<string, any>) {
    if (!this.isProduction()) {
      console.log(`[METRIC] ${name}: ${value}`, attributes);
      return;
    }
    
    const counter = this.meter.createCounter(name);
    counter.add(value, attributes);
  }

  recordPageView(pageName: string) {
    this.metricsService.recordPageView(pageName);
    this.logInfo('Page view', {
      'page.name': pageName,
      'page.url': window.location.href,
      'event.type': 'page_view'
    });
  }

  recordUserAction(action: string, details?: Record<string, any>) {
    this.logInfo('User action', {
      'action.name': action,
      'event.type': 'user_action',
      ...details
    });
  }

  // Logging methods for different severity levels
  logInfo(message: string, attributes?: Record<string, any>) {
    this.sendLog('INFO', message, attributes);
    console.log(`[INFO] ${message}`, attributes);
  }

  logWarn(message: string, attributes?: Record<string, any>) {
    this.sendLog('WARN', message, attributes);
    console.warn(`[WARN] ${message}`, attributes);
  }

  logError(message: string, error?: Error, attributes?: Record<string, any>) {
    const logAttributes = {
      ...attributes,
      ...(error && {
        'error.name': error.name,
        'error.message': error.message,
        'error.stack': error.stack
      })
    };
    this.sendLog('ERROR', message, logAttributes);
    console.error(`[ERROR] ${message}`, error, attributes);
  }

  // Specific logging methods for user activities
  logUserLogin(user?: any, method?: string) {
    const userEmail = user?.email || 'anonymous';
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail.split('@')[0] || 'unknown';
    
    this.metricsService.recordUserLogin();
    this.logInfo('User logged in successfully', {
      'user.id': user?.id || 'anonymous',
      'user.email': userEmail,
      'user.name': userName,
      'auth.method': method || 'supabase',
      'event.type': 'user_login',
      'timestamp': new Date().toISOString()
    });
  }

  logUserLogout(user?: any) {
    const userEmail = user?.email || 'anonymous';
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail.split('@')[0] || 'unknown';
    
    this.metricsService.recordUserLogout();
    this.logInfo('User logged out', {
      'user.id': user?.id || 'anonymous',
      'user.email': userEmail,
      'user.name': userName,
      'event.type': 'user_logout',
      'timestamp': new Date().toISOString()
    });
  }

  logInterestCreated(interest: any, user?: any) {
    const userEmail = user?.email || 'anonymous';
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail.split('@')[0] || 'unknown';
    
    this.metricsService.recordInterestCreated();
    this.logInfo('Interest created', {
      'user.id': user?.id || 'anonymous',
      'user.email': userEmail,
      'user.name': userName,
      'interest.name': interest.name || 'unknown',
      'interest.id': interest.id || 'unknown',
      'event.type': 'interest_created',
      'timestamp': new Date().toISOString()
    });
  }

  logInterestDeleted(interestId: string, user?: any) {
    const userEmail = user?.email || 'anonymous';
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail.split('@')[0] || 'unknown';
    
    this.metricsService.recordInterestDeleted();
    this.logInfo('Interest deleted', {
      'user.id': user?.id || 'anonymous',
      'user.email': userEmail,
      'user.name': userName,
      'interest.id': interestId,
      'event.type': 'interest_deleted',
      'timestamp': new Date().toISOString()
    });
  }

  logTipGenerated(interestId: string, tipContent: string, user?: any) {
    const userEmail = user?.email || 'anonymous';
    const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || userEmail.split('@')[0] || 'unknown';
    
    this.metricsService.recordTipGenerated();
    this.logInfo('Tip generated successfully', {
      'user.id': user?.id || 'anonymous',
      'user.email': userEmail,
      'user.name': userName,
      'interest.id': interestId,
      'tip.length': tipContent.length,
      'event.type': 'tip_generated',
      'timestamp': new Date().toISOString()
    });
  }

  logError500(error: Error, context?: string) {
    this.metricsService.recordError('500');
    this.logError(`Application error in ${context || 'unknown context'}`, error, {
      'error.type': '500',
      'error.context': context || 'unknown',
      'event.type': 'application_error'
    });
  }

  private sendLog(severity: string, message: string, attributes?: Record<string, any>) {
    this.ensureInitialized();
    
    // Only send logs in production environment
    if (!this.isProduction()) {
      console.log(`[${severity}] ${message}`, attributes);
      return;
    }
    
    // Send log via both OpenTelemetry API and direct HTTP (for production reliability)
    this.logger.emit({
      severityNumber: this.getSeverityNumber(severity),
      severityText: severity,
      body: message,
      attributes: attributes || {},
      timestamp: Date.now() * 1000000 // Convert to nanoseconds
    });

    // Also send via direct HTTP to OTEL collector for production
    this.sendLogViaHTTP(severity, message, attributes);
  }

  private sendLogViaHTTP(severity: string, message: string, attributes?: Record<string, any>) {
    // Only send HTTP logs in production
    if (!this.isProduction()) {
      return;
    }

    const logData = {
      resourceLogs: [{
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'kanni-ai-frontend' } },
            { key: 'service.version', value: { stringValue: '1.0.0' } },
            { key: 'deployment.environment', value: { stringValue: 'production' } }
          ]
        },
        scopeLogs: [{
          logRecords: [{
            timeUnixNano: (Date.now() * 1000000).toString(),
            severityText: severity,
            severityNumber: this.getSeverityNumber(severity),
            body: { stringValue: message },
            attributes: Object.entries(attributes || {}).map(([key, value]) => ({
              key,
              value: { stringValue: String(value) }
            }))
          }]
        }]
      }]
    };

    // Use production OTEL endpoint
    const endpoint = '/api/otlp/v1/logs';
    
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logData)
    }).catch(error => {
      console.error('Failed to send log to OTLP collector:', error);
    });
  }



  private getEnvironment(): string {
    if (window.location.hostname === 'kanni-ai.de') {
      return 'production';
    }
    return 'development';
  }

  private isProduction(): boolean {
    return window.location.hostname === 'kanni-ai.de' || window.location.hostname.includes('kanni-ai');
  }

  private ensureInitialized() {
    if (!this.initialized) {
      // Simple initialization without Resource to avoid import issues
      this.initialized = true;
      const env = this.getEnvironment();
      console.log(`OpenTelemetry logging initialized for ${env} environment`);
      
      if (!this.isProduction()) {
        console.log('⚠️  Logging to OTEL collector disabled in development - logs will only appear in console');
      } else {
        console.log('✅ Logging to OTEL collector enabled for production');
      }
    }
  }

  private getSeverityNumber(severity: string): SeverityNumber {
    switch (severity.toLowerCase()) {
      case 'trace': return SeverityNumber.TRACE;
      case 'debug': return SeverityNumber.DEBUG;
      case 'info': return SeverityNumber.INFO;
      case 'warn': return SeverityNumber.WARN;
      case 'error': return SeverityNumber.ERROR;
      case 'fatal': return SeverityNumber.FATAL;
      default: return SeverityNumber.INFO;
    }
  }
}