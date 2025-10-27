# Angular Logging Integration - Production Ready

## Overview
Angular application with OpenTelemetry logging integration that sends logs to Grafana Cloud Loki via OTEL collector in production only.

## Key Features
- **Production-Only Logging**: Logs are only sent to OTEL collector when running on `kanni-ai.de`
- **Development Console Logging**: In development, logs appear only in browser console
- **Comprehensive Event Tracking**: User authentication, interest management, tip generation, errors
- **Structured Logging**: Consistent log format with searchable attributes

## Logging Events

### Authentication
- User login/signup (email, Google, GitHub OAuth)
- User logout
- Authentication failures with error details

### User Activities
- Interest creation/deletion
- AI tip generation success/failure
- Page views and user actions

### Error Tracking
- Application errors with stack traces
- API failures with context
- Network errors

## Architecture
```
Angular App → TelemetryService → (Production Only) → nginx proxy → OTEL Collector → Loki
```

## Production Flow
1. User performs action in Angular app
2. TelemetryService checks if production environment
3. If production: sends structured log to `/api/otlp/v1/logs`
4. nginx proxies to `otel-collector-collector.kanni-ai.svc.cluster.local:4318`
5. OTEL collector processes and sends to Grafana Cloud Loki
6. Logs appear in Grafana Cloud with full context and searchable attributes

## Log Format
```json
{
  "timestamp": "2025-10-27T08:00:00.000Z",
  "severity": "INFO",
  "message": "User logged in successfully",
  "attributes": {
    "user.id": "user-123",
    "auth.method": "email",
    "event.type": "user_login",
    "service.name": "kanni-ai-frontend"
  }
}
```

Ready for deployment via GitHub Actions! 🚀