# Prometheus Monitoring Flow - Kanni AI

## Overview
This document explains the complete flow of Prometheus metrics collection, processing, and visualization in the kanni-ai application.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│  https://kanni-ai.de                                                │
└──────────────────────┬──────────────────────────────────────────────┘
                       │ HTTP Requests
                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    KUBERNETES CLUSTER (GKE)                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Ingress (nginx)                            │  │
│  │  Routes traffic to kanni-ai-service                          │  │
│  └─────────────────────┬────────────────────────────────────────┘  │
│                        │                                             │
│                        ▼                                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              kanni-ai-service (ClusterIP)                     │  │
│  │  Port 80:   HTTP traffic to application                      │  │
│  │  Port 9113: Metrics endpoint for nginx-exporter              │  │
│  └──┬────────────────────────────────────────┬──────────────────┘  │
│     │                                         │                      │
│     ▼                                         ▼                      │
│  ┌─────────────────────────────────┐  ┌─────────────────────────┐  │
│  │   kanni-ai-app Pod              │  │                         │  │
│  │  ┌──────────────────────────┐   │  │                         │  │
│  │  │  Container: kanni-ai     │   │  │                         │  │
│  │  │  (nginx + Angular)       │   │  │                         │  │
│  │  │  Port: 80                │   │  │                         │  │
│  │  │                          │   │  │                         │  │
│  │  │  Endpoints:              │   │  │                         │  │
│  │  │  • /nginx_status         │◄──┼──┼─────────────┐           │  │
│  │  │    (stub_status)         │   │  │             │           │  │
│  │  │  • /metrics.txt          │   │  │             │           │  │
│  │  │    (static backup)       │   │  │             │           │  │
│  │  │  • /api/otlp/            │   │  │             │           │  │
│  │  │    (proxy to OTEL)       │   │  │             │           │  │
│  │  └──────────────────────────┘   │  │             │           │  │
│  │                                  │  │             │           │  │
│  │  ┌──────────────────────────┐   │  │    Scrapes │           │  │
│  │  │  Container:              │   │  │             │           │  │
│  │  │  nginx-exporter          │   │  │             │           │  │
│  │  │  Port: 9113              │   │  │             │           │  │
│  │  │                          │   │  │             │           │  │
│  │  │  Scrapes:                │   │  │             │           │  │
│  │  │  http://localhost:80/    │───┘  │             │           │  │
│  │  │  nginx_status            │      │             │           │  │
│  │  │                          │      │             │           │  │
│  │  │  Exposes:                │      │             │           │  │
│  │  │  nginx_http_requests_    │      │             │           │  │
│  │  │  total, nginx_           │      │             │           │  │
│  │  │  connections_active,     │      │             │           │  │
│  │  │  etc.                    │      │             │           │  │
│  │  └──────────────────────────┘      │             │           │  │
│  └─────────────────────────────────────┘             │           │  │
│                                                       │           │  │
│                                         ┌─────────────▼────────┐  │
│                                         │                      │  │
│                                         │  OTEL Collector Pod  │  │
│                                         │                      │  │
│                                         │  Prometheus Receiver │  │
│                                         │  ┌────────────────┐  │  │
│                                         │  │ Scrape Configs │  │  │
│                                         │  │                │  │  │
│                                         │  │ Job 1:         │  │  │
│                                         │  │ kanni-ai-nginx │  │  │
│                                         │  │ Target:        │  │  │
│                                         │  │ :9113/metrics  │──┘  │
│                                         │  │ Every 30s      │     │
│                                         │  │                │     │
│                                         │  │ Relabeling:    │     │
│                                         │  │ • Keep only    │     │
│                                         │  │   nginx_*      │     │
│                                         │  │ • Rename       │     │
│                                         │  │   nginx_http_  │     │
│                                         │  │   requests_    │     │
│                                         │  │   total →      │     │
│                                         │  │   http_        │     │
│                                         │  │   requests_    │     │
│                                         │  │   total        │     │
│                                         │  │ • Add label    │     │
│                                         │  │   service_name │     │
│                                         │  │   =kanni-ai-   │     │
│                                         │  │   frontend     │     │
│                                         │  │                │     │
│                                         │  │ Job 2:         │     │
│                                         │  │ kanni-ai-app   │     │
│                                         │  │ Target:        │     │
│                                         │  │ :80/metrics.txt│     │
│                                         │  │ Every 30s      │     │
│                                         │  └────────────────┘     │
│                                         │                         │
│                                         │  Processors:            │
│                                         │  • Batch (10s timeout)  │
│                                         │  • Resource (adds       │
│                                         │    service.name,        │
│                                         │    environment)         │
│                                         │                         │
│                                         │  Exporters:             │
│                                         │  • prometheusremote     │
│                                         │    write                │
│                                         │  • debug (logging)      │
│                                         └──────┬──────────────────┘
│                                                │                   │
└────────────────────────────────────────────────┼───────────────────┘
                                                 │
                                                 │ Remote Write
                                                 │ (BasicAuth)
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GRAFANA CLOUD                                     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Prometheus (prometheus-prod-65-prod-eu-west-2)            │    │
│  │  https://prometheus-prod-65-prod-eu-west-2.grafana.net     │    │
│  │                                                             │    │
│  │  Stores metrics:                                           │    │
│  │  • http_requests_total{service_name="kanni-ai-frontend"}   │    │
│  │  • nginx_connections_active{service_name="..."}            │    │
│  │  • nginx_connections_waiting{service_name="..."}           │    │
│  │  • app_info{service="kanni-ai-frontend"}                   │    │
│  │  • app_uptime_seconds                                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Grafana Dashboard                                          │    │
│  │  "Kanni AI - Application Monitoring Dashboard"             │    │
│  │                                                             │    │
│  │  Panels using Prometheus metrics:                          │    │
│  │  • HTTP Requests per Minute                                │    │
│  │    Query: rate(nginx_http_requests_total[5m]) * 60         │    │
│  │                                                             │    │
│  │  • HTTP Request Rate by Endpoint                           │    │
│  │    Query: sum by (status)                                  │    │
│  │           (rate(nginx_http_requests_total[5m]))            │    │
│  │                                                             │    │
│  │  • Errors per Minute                                       │    │
│  │    Query: sum(rate(nginx_http_requests_total               │    │
│  │           {status=~"[45].*"}[5m])) * 60                    │    │
│  │                                                             │    │
│  │  Note: http_requests_total is the renamed version of       │    │
│  │        nginx_http_requests_total                           │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Breakdown

### 1. **nginx (in kanni-ai container)**
**Location**: `kanni-ai` pod, port 80  
**Configuration**: `/etc/nginx/nginx.conf`

**Responsibilities**:
- Serves the Angular application
- Provides `/nginx_status` endpoint with stub_status module
- Provides `/metrics.txt` endpoint with static backup metrics
- Proxies `/api/otlp/` to OTEL collector for client-side logs

**Key Endpoints**:
```nginx
location /nginx_status {
    stub_status on;
    access_log off;
}

location /metrics.txt {
    # Returns static Prometheus-format metrics
    # app_info, http_requests_total (placeholder), app_uptime_seconds
}
```

**Metrics exposed at /nginx_status** (internal only):
```
Active connections: 1
server accepts handled requests
 123 123 456
Reading: 0 Writing: 1 Waiting: 0
```

---

### 2. **nginx-prometheus-exporter**
**Location**: Sidecar container in `kanni-ai` pod, port 9113  
**Image**: `nginx/nginx-prometheus-exporter:1.1.0`

**Responsibilities**:
- Scrapes `http://localhost:80/nginx_status` every few seconds
- Converts nginx stub_status into Prometheus metrics format
- Exposes metrics on port 9113 at `/metrics`

**Metrics exposed** (at http://kanni-ai-service:9113/metrics):
```prometheus
# HELP nginx_http_requests_total Total http requests
# TYPE nginx_http_requests_total counter
nginx_http_requests_total 14983

# HELP nginx_connections_active Active connections
# TYPE nginx_connections_active gauge
nginx_connections_active 1

# HELP nginx_connections_waiting Waiting connections
# TYPE nginx_connections_waiting gauge
nginx_connections_waiting 0

# And more nginx_* metrics...
```

---

### 3. **kanni-ai-service (Kubernetes Service)**
**Type**: ClusterIP  
**Namespace**: kanni-ai

**Ports**:
- **Port 80**: Routes traffic to kanni-ai container (HTTP)
- **Port 9113**: Routes traffic to nginx-exporter (Metrics)

**Labels**:
```yaml
app: kanni-ai
job: nginx-exporter
```

---

### 4. **OTEL Collector - Prometheus Receiver**
**Location**: `otel-collector` pod in kanni-ai namespace  
**Configuration**: `k8s/otel-collector.yaml`

**Scrape Configuration**:

**Job 1: kanni-ai-nginx**
```yaml
- job_name: 'kanni-ai-nginx'
  static_configs:
    - targets: ['kanni-ai-service:9113']
  metrics_path: '/metrics'
  scrape_interval: 30s
  scrape_timeout: 10s
  metric_relabel_configs:
    # Keep only nginx_* metrics
    - source_labels: [__name__]
      regex: 'nginx_.*'
      action: keep
    
    # Rename nginx_http_requests_total to http_requests_total
    - source_labels: [__name__]
      regex: 'nginx_http_requests_total'
      target_label: __name__
      replacement: 'http_requests_total'
    
    # Add service_name label
    - source_labels: [__name__]
      target_label: service_name
      replacement: 'kanni-ai-frontend'
```

**Job 2: kanni-ai-app**
```yaml
- job_name: 'kanni-ai-app'
  static_configs:
    - targets: ['kanni-ai-service:80']
  metrics_path: '/metrics.txt'
  scrape_interval: 30s
  scrape_timeout: 10s
  metric_relabel_configs:
    - source_labels: [__name__]
      target_label: service_name
      replacement: 'kanni-ai-frontend'
```

**Processing Pipeline**:
```
Prometheus Receiver → Batch Processor → Resource Processor → Prometheus Remote Write Exporter
                                                           → Debug Exporter (logging)
```

**Processors**:
- **Batch**: Groups metrics, sends every 10s or 512 samples
- **Resource**: Adds `service.name=kanni-ai-frontend` and `deployment.environment=production`

---

### 5. **Grafana Cloud Prometheus**
**Endpoint**: `https://prometheus-prod-65-prod-eu-west-2.grafana.net/api/prom/push`  
**Authentication**: BasicAuth with username `2737163` and token from secret

**Stores metrics**:
```prometheus
http_requests_total{service_name="kanni-ai-frontend"}
nginx_connections_active{service_name="kanni-ai-frontend"}
nginx_connections_waiting{service_name="kanni-ai-frontend"}
app_info{service="kanni-ai-frontend",version="1.0.0",environment="production"}
app_uptime_seconds
```

---

### 6. **Grafana Dashboard**
**File**: `grafana-dashboard.json`  
**Dashboard ID**: mkxqmsx

**Key Panels using Prometheus**:

1. **HTTP Requests per Minute**
   ```promql
   rate(nginx_http_requests_total{job="nginx-exporter"}[5m]) * 60
   ```
   - Shows requests per minute using the original metric name
   - Note: Should be updated to use `http_requests_total`

2. **HTTP Request Rate by Endpoint**
   ```promql
   sum by (status) (rate(nginx_http_requests_total{job="nginx-exporter"}[5m]))
   ```

3. **Errors per Minute**
   ```promql
   sum(rate(nginx_http_requests_total{job="nginx-exporter",status=~"[45].*"}[5m])) * 60
   ```

---

## Data Flow Timeline

```
T=0s    User visits https://kanni-ai.de
        ↓
T=0s    Ingress routes to kanni-ai-service:80
        ↓
T=0s    nginx serves Angular app, increments request counter in stub_status
        ↓
T=1s    nginx-exporter scrapes http://localhost:80/nginx_status
        ↓
T=1s    nginx-exporter updates nginx_http_requests_total counter
        ↓
T=30s   OTEL Collector scrapes http://kanni-ai-service:9113/metrics
        ↓
T=30s   OTEL Collector applies metric relabeling:
        - Keeps only nginx_* metrics
        - Renames nginx_http_requests_total → http_requests_total
        - Adds service_name=kanni-ai-frontend label
        ↓
T=40s   OTEL Collector batch processor sends metrics to Grafana Cloud
        (every 10s or when 512 samples collected)
        ↓
T=40s   Grafana Cloud Prometheus receives and stores metrics
        ↓
T=41s   Grafana Dashboard queries Prometheus and displays updated values
```

---

## Metric Transformation Example

### Original Metric (from nginx-exporter)
```prometheus
nginx_http_requests_total 15234
```

### After OTEL Collector Processing
```prometheus
http_requests_total{service_name="kanni-ai-frontend",deployment_environment="production",service_version="1.0.0"} 15234
```

---

## Testing the Flow

### 1. Check nginx stub_status
```bash
kubectl exec -n kanni-ai deployment/kanni-ai-app -c kanni-ai -- curl -s http://localhost:80/nginx_status
```

### 2. Check nginx-exporter metrics
```bash
kubectl run -n kanni-ai curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
  curl -s http://kanni-ai-service:9113/metrics | grep nginx_http
```

### 3. Check OTEL Collector is scraping
```bash
kubectl logs -n kanni-ai -l app.kubernetes.io/component=opentelemetry-collector --tail=100 | grep "http_requests_total"
```

### 4. Generate traffic
```bash
for i in {1..20}; do curl -s https://kanni-ai.de/ > /dev/null; done
```

### 5. Verify metric increase
Wait 30 seconds, then run step 2 again and compare values.

---

## Troubleshooting

### Issue: Metrics showing zero in Grafana

**Check 1**: Verify nginx-exporter is running
```bash
kubectl get pods -n kanni-ai -l app=kanni-ai
# Should show both containers: kanni-ai and nginx-exporter
```

**Check 2**: Verify service exposes port 9113
```bash
kubectl get svc kanni-ai-service -n kanni-ai -o yaml | grep 9113
```

**Check 3**: Verify OTEL collector configuration
```bash
kubectl get opentelemetrycollector -n kanni-ai otel-collector -o yaml
```

**Check 4**: Check OTEL collector logs for errors
```bash
kubectl logs -n kanni-ai -l app.kubernetes.io/component=opentelemetry-collector --tail=200
```

**Check 5**: Verify metrics are being scraped
```bash
kubectl logs -n kanni-ai -l app.kubernetes.io/component=opentelemetry-collector | grep "Name:" | grep http
```

---

## Key Files

- **nginx.conf**: nginx configuration with stub_status and metrics endpoints
- **k8s/deployment.yaml**: Pod with nginx-exporter sidecar
- **k8s/service.yaml**: Service exposing ports 80 and 9113
- **k8s/otel-collector.yaml**: OTEL Collector with Prometheus receiver configuration
- **grafana-dashboard.json**: Grafana dashboard with Prometheus queries

---

## Current Status

✅ nginx-exporter running and exposing metrics on port 9113  
✅ OTEL Collector scraping nginx-exporter every 30s  
✅ Metric relabeling: nginx_http_requests_total → http_requests_total  
✅ Metrics being sent to Grafana Cloud Prometheus  
✅ Dashboard configured to query Prometheus  
✅ Service exposing correct ports  

⚠️  Some dashboard panels still use old metric name `nginx_http_requests_total` instead of `http_requests_total`

---

## Metrics Available in Prometheus

| Metric Name | Type | Description | Source |
|-------------|------|-------------|--------|
| `http_requests_total` | counter | Total HTTP requests (renamed from nginx_http_requests_total) | nginx-exporter |
| `nginx_connections_active` | gauge | Active nginx connections | nginx-exporter |
| `nginx_connections_waiting` | gauge | Idle keepalive connections | nginx-exporter |
| `nginx_connections_reading` | gauge | Connections reading request | nginx-exporter |
| `nginx_connections_writing` | gauge | Connections writing response | nginx-exporter |
| `app_info` | gauge | Application metadata | /metrics.txt |
| `app_uptime_seconds` | gauge | Application uptime (static backup) | /metrics.txt |

All metrics have the label: `service_name="kanni-ai-frontend"`
