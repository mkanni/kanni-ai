import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsHttpInterceptor implements HttpInterceptor {
  constructor(private metricsService: MetricsService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const startTime = Date.now();
    
    return next.handle(req).pipe(
      tap(event => {
        if (event instanceof HttpResponse) {
          const duration = Date.now() - startTime;
          this.metricsService.recordHttpRequest(
            req.method,
            req.url,
            event.status,
            duration
          );

          // Special handling for Supabase requests
          if (req.url.includes('supabase.co')) {
            const operation = this.getSupabaseOperation(req.url, req.method);
            this.metricsService.recordSupabaseLatency(operation, duration, true);
          }
        }
      }),
      catchError((error: HttpErrorResponse) => {
        const duration = Date.now() - startTime;
        this.metricsService.recordHttpRequest(
          req.method,
          req.url,
          error.status || 500,
          duration
        );

        // Special handling for Supabase errors
        if (req.url.includes('supabase.co')) {
          const operation = this.getSupabaseOperation(req.url, req.method);
          this.metricsService.recordSupabaseLatency(operation, duration, false);
        }

        throw error;
      })
    );
  }

  private getSupabaseOperation(url: string, method: string): string {
    if (url.includes('/auth/v1')) {
      return method === 'POST' ? 'auth_login' : 'auth_check';
    } else if (url.includes('/rest/v1')) {
      return `rest_${method.toLowerCase()}`;
    } else if (url.includes('/storage/v1')) {
      return `storage_${method.toLowerCase()}`;
    } else {
      return `supabase_${method.toLowerCase()}`;
    }
  }
}