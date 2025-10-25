# GitOps Deployment Guide for Kanni AI

## Overview
This guide provides step-by-step instructions to deploy the Kanni AI Angular application to Google Kubernetes Engine (GKE) using GitOps with GitHub Actions, OpenTelemetry observability, and zero-downtime deployments.

## Prerequisites
- Google Cloud Platform account with billing enabled
- GitHub repository access
- Domain: kanni-ai.de (purchased from Strato)
- Grafana Cloud account (for Loki and Prometheus)

## Architecture Overview
```
GitHub → GitHub Actions → Docker Registry → GKE Cluster → kanni-ai.de
                                            ↓
                        OpenTelemetry → Grafana Cloud (Loki + Prometheus)
```

## Phase 1: Google Cloud Setup

### 1.1 Enable Required APIs
```bash
gcloud services enable container.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable dns.googleapis.com
```

### 1.2 Create GKE Cluster
```bash
# Create cluster with minimal resources
gcloud container clusters create kanni-ai-cluster \
  --zone=europe-west3-a \
  --machine-type=e2-micro \
  --num-nodes=2 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=3 \
  --disk-size=10GB \
  --enable-autorepair \
  --enable-autoupgrade \
  --enable-ip-alias \
  --network="default" \
  --subnetwork="default"
```

### 1.3 Create Service Account for GitHub Actions
```bash
gcloud iam service-accounts create github-actions-sa \
  --display-name="GitHub Actions Service Account"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions-sa@PROJECT_ID.iam.gserviceaccount.com
```

### 1.4 Setup Google Cloud DNS
```bash
# Create DNS zone for your domain
gcloud dns managed-zones create kanni-ai-zone \
  --dns-name="kanni-ai.de." \
  --description="DNS zone for kanni-ai.de"

# Get name servers (configure these in Strato DNS settings)
gcloud dns managed-zones describe kanni-ai-zone --format="value(nameServers)"
```

## Phase 2: OpenTelemetry Setup

### 2.1 Install OpenTelemetry Operator
```bash
kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml
```

### 2.2 Create OpenTelemetry Collector Configuration
**File: `k8s/otel-collector.yaml`**
```yaml
apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: otel-collector
  namespace: kanni-ai
spec:
  config: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
      prometheus:
        config:
          scrape_configs:
            - job_name: 'kubernetes-pods'
              kubernetes_sd_configs:
                - role: pod
              relabel_configs:
                - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
                  action: keep
                  regex: true

    processors:
      batch:
      resource:
        attributes:
          - key: service.name
            value: kanni-ai
            action: upsert

    exporters:
      prometheusremotewrite:
        endpoint: "https://prometheus-prod-01-eu-west-0.grafana.net/api/prom/push"
        headers:
          authorization: "Bearer YOUR_GRAFANA_PROMETHEUS_TOKEN"
      
      loki:
        endpoint: "https://logs-prod-eu-west-0.grafana.net/loki/api/v1/push"
        headers:
          authorization: "Bearer YOUR_GRAFANA_LOKI_TOKEN"

    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch, resource]
          exporters: [loki]
        metrics:
          receivers: [otlp, prometheus]
          processors: [batch, resource]
          exporters: [prometheusremotewrite]
        logs:
          receivers: [otlp]
          processors: [batch, resource]
          exporters: [loki]
```

## Phase 3: Kubernetes Manifests

### 3.1 Create Namespace
**File: `k8s/namespace.yaml`**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kanni-ai
  labels:
    name: kanni-ai
```

### 3.2 Application Deployment
**File: `k8s/deployment.yaml`**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kanni-ai-app
  namespace: kanni-ai
  labels:
    app: kanni-ai
spec:
  replicas: 2
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: kanni-ai
  template:
    metadata:
      labels:
        app: kanni-ai
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "80"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: kanni-ai
        image: gcr.io/PROJECT_ID/kanni-ai:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 5
        env:
        - name: OTEL_EXPORTER_OTLP_ENDPOINT
          value: "http://otel-collector-collector.kanni-ai.svc.cluster.local:4318"
        - name: OTEL_SERVICE_NAME
          value: "kanni-ai-frontend"
        - name: OTEL_RESOURCE_ATTRIBUTES
          value: "service.name=kanni-ai-frontend,service.version=1.0.0"
```

### 3.3 Service Configuration
**File: `k8s/service.yaml`**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: kanni-ai-service
  namespace: kanni-ai
spec:
  selector:
    app: kanni-ai
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
```

### 3.4 Ingress with SSL
**File: `k8s/ingress.yaml`**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kanni-ai-ingress
  namespace: kanni-ai
  annotations:
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.global-static-ip-name: "kanni-ai-ip"
    networking.gke.io/managed-certificates: "kanni-ai-ssl-cert"
    kubernetes.io/ingress.allow-http: "false"
spec:
  rules:
  - host: kanni-ai.de
    http:
      paths:
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: kanni-ai-service
            port:
              number: 80
---
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: kanni-ai-ssl-cert
  namespace: kanni-ai
spec:
  domains:
    - kanni-ai.de
```

### 3.5 Horizontal Pod Autoscaler
**File: `k8s/hpa.yaml`**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kanni-ai-hpa
  namespace: kanni-ai
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kanni-ai-app
  minReplicas: 2
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Phase 4: Docker Configuration

### 4.1 Create Dockerfile
**File: `Dockerfile`**
```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist/kanni-poc /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Add OpenTelemetry instrumentation
RUN apk add --no-cache curl
COPY otel-nginx.conf /etc/nginx/conf.d/otel.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 4.2 Create Nginx Configuration
**File: `nginx.conf`**
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Logging format for OpenTelemetry
    log_format json_combined escape=json
    '{'
        '"time_local":"$time_local",'
        '"remote_addr":"$remote_addr",'
        '"remote_user":"$remote_user",'
        '"request":"$request",'
        '"status": "$status",'
        '"body_bytes_sent":"$body_bytes_sent",'
        '"request_time":"$request_time",'
        '"http_referrer":"$http_referer",'
        '"http_user_agent":"$http_user_agent"'
    '}';

    access_log /var/log/nginx/access.log json_combined;
    error_log /var/log/nginx/error.log;

    sendfile        on;
    keepalive_timeout  65;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # Angular routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }

        # Metrics endpoint for Prometheus
        location /metrics {
            stub_status on;
            access_log off;
        }
    }
}
```

## Phase 5: GitHub Actions Workflow

### 5.1 Create GitHub Secrets
Add these secrets in your GitHub repository settings:
- `GCP_SA_KEY`: Content of the service account key.json file
- `GCP_PROJECT_ID`: Your Google Cloud project ID
- `GRAFANA_PROMETHEUS_TOKEN`: Grafana Cloud Prometheus token
- `GRAFANA_LOKI_TOKEN`: Grafana Cloud Loki token

### 5.2 Create Workflow
**File: `.github/workflows/deploy.yml`**
```yaml
name: Deploy to GKE

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  GKE_CLUSTER: kanni-ai-cluster
  GKE_ZONE: europe-west3-a
  DEPLOYMENT_NAME: kanni-ai-app
  IMAGE: kanni-ai
  NAMESPACE: kanni-ai

jobs:
  setup-build-publish-deploy:
    name: Setup, Build, Publish, and Deploy
    runs-on: ubuntu-latest
    environment: production

    steps:
    - name: Checkout
      uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm run test -- --watch=false --browsers=ChromeHeadless

    - name: Build application
      run: npm run build

    - name: Setup Google Cloud CLI
      uses: google-github-actions/setup-gcloud@v1
      with:
        service_account_key: ${{ secrets.GCP_SA_KEY }}
        project_id: ${{ secrets.GCP_PROJECT_ID }}

    - name: Configure Docker to use gcloud as a credential helper
      run: |-
        gcloud --quiet auth configure-docker

    - name: Get the GKE credentials
      run: |-
        gcloud container clusters get-credentials "$GKE_CLUSTER" --zone "$GKE_ZONE"

    - name: Build the Docker image
      run: |-
        docker build \
          --tag "gcr.io/${{ secrets.GCP_PROJECT_ID }}/$IMAGE:$GITHUB_SHA" \
          --tag "gcr.io/${{ secrets.GCP_PROJECT_ID }}/$IMAGE:latest" \
          .

    - name: Publish the Docker image to GCR
      run: |-
        docker push "gcr.io/${{ secrets.GCP_PROJECT_ID }}/$IMAGE:$GITHUB_SHA"
        docker push "gcr.io/${{ secrets.GCP_PROJECT_ID }}/$IMAGE:latest"

    - name: Set up Kustomize
      run: |-
        curl -sfLo kustomize https://github.com/kubernetes-sigs/kustomize/releases/download/v3.1.0/kustomize_3.1.0_linux_amd64
        chmod u+x ./kustomize

    - name: Deploy
      run: |-
        # Replace the image name in the k8s template
        ./kustomize edit set image gcr.io/PROJECT_ID/IMAGE:TAG=gcr.io/${{ secrets.GCP_PROJECT_ID }}/$IMAGE:$GITHUB_SHA
        ./kustomize build . | kubectl apply -f -
        kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE
        kubectl get services -o wide -n $NAMESPACE
```

### 5.3 Create Kustomization
**File: `kustomization.yaml`**
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- k8s/namespace.yaml
- k8s/deployment.yaml
- k8s/service.yaml
- k8s/ingress.yaml
- k8s/hpa.yaml
- k8s/otel-collector.yaml

images:
- name: gcr.io/PROJECT_ID/IMAGE:TAG
  newName: gcr.io/PROJECT_ID/kanni-ai
  newTag: latest

replicas:
- name: kanni-ai-app
  count: 2

patches:
- target:
    kind: Deployment
    name: kanni-ai-app
  patch: |-
    - op: replace
      path: /spec/template/spec/containers/0/image
      value: gcr.io/PROJECT_ID/kanni-ai:latest
```

## Phase 6: Angular OpenTelemetry Integration

### 6.1 Install OpenTelemetry Dependencies
```bash
npm install @opentelemetry/api @opentelemetry/sdk-web @opentelemetry/exporter-otlp-http @opentelemetry/instrumentation-fetch @opentelemetry/instrumentation-xml-http-request @opentelemetry/instrumentation-user-interaction
```

### 6.2 Create OpenTelemetry Service
**File: `src/app/services/telemetry.service.ts`**
```typescript
import { Injectable } from '@angular/core';
import { trace, metrics, logs } from '@opentelemetry/api';
import { WebSDK } from '@opentelemetry/sdk-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

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
    const sdk = new WebSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'kanni-ai-frontend',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      }),
      traceExporter: new OTLPTraceExporter({
        url: '/api/v1/traces',
      }),
    });

    sdk.start();
  }

  createSpan(name: string, attributes?: Record<string, any>) {
    return this.tracer.startSpan(name, { attributes });
  }

  recordMetric(name: string, value: number, attributes?: Record<string, any>) {
    const counter = this.meter.createCounter(name);
    counter.add(value, attributes);
  }
}
```

## Phase 7: Monitoring and Alerting

### 7.1 Grafana Dashboard Configuration
Create a Grafana dashboard with these panels:
- Application performance metrics
- Error rates and response times
- Infrastructure metrics (CPU, memory usage)
- User interaction analytics
- Log aggregation from Loki

### 7.2 Alert Rules
Configure alerts for:
- High error rates (>5%)
- Response time degradation (>2s)
- High resource usage (>80%)
- Application downtime

## Phase 8: Domain Configuration

### 8.1 Create Static IP
```bash
gcloud compute addresses create kanni-ai-ip --global
gcloud compute addresses describe kanni-ai-ip --global
```

### 8.2 Configure DNS in Strato
1. Log into your Strato account
2. Navigate to DNS management for kanni-ai.de
3. Update nameservers to Google Cloud DNS nameservers
4. Create A record pointing to the static IP

### 8.3 Update DNS in Google Cloud
```bash
gcloud dns record-sets transaction start --zone=kanni-ai-zone
gcloud dns record-sets transaction add YOUR_STATIC_IP --name=kanni-ai.de. --ttl=300 --type=A --zone=kanni-ai-zone
gcloud dns record-sets transaction execute --zone=kanni-ai-zone
```

## Phase 9: Testing and Validation

### 9.1 Deployment Validation Script
**File: `scripts/validate-deployment.sh`**
```bash
#!/bin/bash

# Check if pods are running
kubectl get pods -n kanni-ai -l app=kanni-ai

# Check if service is accessible
kubectl get svc -n kanni-ai

# Check ingress status
kubectl get ingress -n kanni-ai

# Test application endpoint
curl -I https://kanni-ai.de

# Check OpenTelemetry collector
kubectl logs -n kanni-ai deployment/otel-collector-collector

echo "Deployment validation complete!"
```

### 9.2 Load Testing
Use tools like Apache Bench or k6 to test zero-downtime deployments:
```bash
# Run during deployment to verify zero downtime
while true; do curl -s -o /dev/null -w "%{http_code}\n" https://kanni-ai.de; sleep 1; done
```

## Phase 10: Security and Best Practices

### 10.1 Pod Security Policy
**File: `k8s/security-policy.yaml`**
```yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: kanni-ai-psp
  namespace: kanni-ai
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
```

### 10.2 Network Policies
**File: `k8s/network-policy.yaml`**
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: kanni-ai-netpol
  namespace: kanni-ai
spec:
  podSelector:
    matchLabels:
      app: kanni-ai
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 80
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 80
    - protocol: UDP
      port: 53
```

## Implementation Steps Summary

1. **Setup GCP Infrastructure** (Phase 1)
2. **Configure OpenTelemetry** (Phase 2)
3. **Create Kubernetes Manifests** (Phase 3)
4. **Build Docker Configuration** (Phase 4)
5. **Setup GitHub Actions** (Phase 5)
6. **Integrate Frontend Telemetry** (Phase 6)
7. **Configure Monitoring** (Phase 7)
8. **Setup Domain** (Phase 8)
9. **Test and Validate** (Phase 9)
10. **Apply Security Policies** (Phase 10)

## Expected Results

After completing this guide:
- ✅ Zero-downtime deployments on every push to main
- ✅ Minimal resource usage (64Mi RAM, 50m CPU requests)
- ✅ SSL-enabled access via https://kanni-ai.de
- ✅ Comprehensive observability with Grafana Cloud
- ✅ Automated scaling based on resource usage
- ✅ Production-ready security policies
- ✅ Full GitOps workflow with GitHub Actions

## Troubleshooting

Common issues and solutions:
- **DNS propagation**: Allow 24-48 hours for full propagation
- **SSL certificate**: Check ManagedCertificate status with `kubectl describe managedcertificate`
- **Resource limits**: Monitor with `kubectl top pods -n kanni-ai`
- **OpenTelemetry**: Check collector logs for connectivity issues

## Cost Optimization

This setup is optimized for minimal costs:
- e2-micro instances (free tier eligible)
- Minimal resource requests
- Efficient autoscaling policies
- Optimized Docker images

Estimated monthly cost: ~$10-20 USD for the GKE cluster.