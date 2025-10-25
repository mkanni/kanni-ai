# 🚀 Kanni AI Deployment Implementation Guide

## Current Status ✅
- ✅ Docker configuration created (Dockerfile + nginx.conf)
- ✅ Kubernetes manifests created (k8s/ directory)
- ✅ GitHub Actions workflow configured
- ✅ OpenTelemetry service structure prepared
- ✅ Validation scripts ready

## Implementation Order 🎯

### Phase 1: Infrastructure Setup (Run Once)

#### 1.1 Update GCP Project ID
Edit `scripts/setup-gcp-infrastructure.sh` and replace `your-gcp-project-id` with your actual GCP project ID:

```bash
# Line 6 in the script
PROJECT_ID="your-actual-project-id"
```

#### 1.2 Run GCP Infrastructure Setup
```bash
# Make sure you're authenticated with gcloud
gcloud auth login
gcloud auth application-default login

# Run the infrastructure setup
./scripts/setup-gcp-infrastructure.sh
```

This script will:
- Enable required GCP APIs
- Create GKE Autopilot cluster in europe-west3
- Create service account for GitHub Actions
- Generate service account key (key.json)
- Create static IP address
- Set up DNS zone for kanni-ai.de
- Configure DNS records

#### 1.3 Configure Domain DNS
After running the script, you'll see DNS nameservers. Configure these in your Strato domain management:
1. Log into Strato account
2. Go to domain management for kanni-ai.de
3. Update nameservers to the ones shown by the script

### Phase 2: GitHub Configuration

#### 2.1 Add GitHub Secrets
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these 4 secrets (see `GITHUB_SECRETS_GUIDE.md` for details):
- `GCP_SA_KEY`: Content of key.json from the infrastructure setup
- `GCP_PROJECT_ID`: Your GCP project ID
- `GRAFANA_PROMETHEUS_TOKEN`: From Grafana Cloud (MetricsPublisher role)
- `GRAFANA_LOKI_TOKEN`: From Grafana Cloud (LogsPublisher role)

#### 2.2 Update Kubernetes Manifests
Update the PROJECT_ID placeholders in these files:
- `k8s/deployment.yaml` (line 29): Replace `gcr.io/PROJECT_ID/kanni-ai:latest`
- `kustomization.yaml` (lines 14, 15, 23): Replace PROJECT_ID with your actual project ID

### Phase 3: Grafana Cloud Setup

#### 3.1 Get Grafana Endpoints
In your Grafana Cloud account, note down:
- Prometheus endpoint (usually `https://prometheus-prod-01-eu-west-0.grafana.net/api/prom/push`)
- Loki endpoint (usually `https://logs-prod-eu-west-0.grafana.net/loki/api/v1/push`)

#### 3.2 Update OpenTelemetry Collector
Edit `k8s/otel-collector.yaml` and update:
- Line 29: Replace with your Prometheus endpoint
- Line 31: Replace `YOUR_GRAFANA_PROMETHEUS_TOKEN`
- Line 34: Replace with your Loki endpoint  
- Line 36: Replace `YOUR_GRAFANA_LOKI_TOKEN`

### Phase 4: Deploy OpenTelemetry Operator

Before the first deployment, install the OpenTelemetry operator:

```bash
# Get cluster credentials
gcloud container clusters get-credentials kanni-ai-cluster --region=europe-west3

# Install OpenTelemetry operator
kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml
```

### Phase 5: First Deployment

#### 5.1 Test Build Locally (Optional)
```bash
# Test Docker build
docker build -t kanni-ai-test .

# Test Angular build
npm run build
```

#### 5.2 Commit and Push
```bash
git add .
git commit -m "feat: add complete deployment infrastructure

- Add Dockerfile with multi-stage build
- Add Kubernetes manifests for production deployment
- Add GitHub Actions workflow for CI/CD
- Add OpenTelemetry configuration
- Add validation and setup scripts"

git push origin main
```

This will trigger the GitHub Actions workflow which will:
1. Run tests
2. Build the Angular application
3. Build and push Docker image to GCR
4. Deploy to GKE cluster
5. Set up zero-downtime rolling updates

### Phase 6: Post-Deployment Verification

#### 6.1 Monitor Deployment
```bash
# Watch the GitHub Actions workflow in your repository's Actions tab

# Monitor pods
kubectl get pods -n kanni-ai -w

# Check deployment status
kubectl rollout status deployment/kanni-ai-app -n kanni-ai
```

#### 6.2 Run Validation Script
```bash
./scripts/validate-deployment.sh
```

#### 6.3 Check SSL Certificate
SSL certificates can take up to 60 minutes to provision:
```bash
kubectl get managedcertificate kanni-ai-ssl-cert -n kanni-ai -o yaml
```

### Phase 7: Access Your Application

Once everything is deployed and SSL is ready:
- **Production URL**: https://kanni-ai.de
- **Health Check**: https://kanni-ai.de/health
- **Metrics**: https://kanni-ai.de/metrics

## Ongoing Operations 🔄

### Automatic Deployments
Every push to the `main` branch will:
1. Run tests
2. Build new Docker image
3. Deploy with zero downtime
4. Update logs and metrics in Grafana

### Monitoring
- **Logs**: Check Grafana Cloud → Explore → Loki
- **Metrics**: Check Grafana Cloud → Explore → Prometheus
- **Kubernetes**: Use `kubectl` commands or GCP Console

### Scaling
The HPA will automatically scale pods based on:
- CPU usage (70% threshold)
- Memory usage (80% threshold)
- Min replicas: 2, Max replicas: 5

### Troubleshooting
```bash
# Check pod logs
kubectl logs -n kanni-ai deployment/kanni-ai-app

# Check ingress status
kubectl describe ingress kanni-ai-ingress -n kanni-ai

# Check certificate status
kubectl describe managedcertificate kanni-ai-ssl-cert -n kanni-ai

# Run validation
./scripts/validate-deployment.sh
```

## Expected Timeline ⏱️

- **Infrastructure setup**: 10-15 minutes
- **First deployment**: 5-10 minutes
- **DNS propagation**: 1-24 hours
- **SSL certificate**: 15-60 minutes
- **Subsequent deployments**: 3-5 minutes

## Cost Optimization 💰

This setup is optimized for minimal costs:
- GKE Autopilot (pay only for running pods)
- Minimal resource requests (64Mi RAM, 50m CPU)
- Efficient Docker images with multi-stage builds
- Auto-scaling based on actual usage

**Estimated monthly cost**: $15-30 USD

## Security Features 🔒

- SSL/TLS encryption (automatic certificates)
- Container image vulnerability scanning
- Least privilege service accounts
- Network policies (can be added)
- Resource limits and quotas
- Secrets management with GitHub Secrets

---

🎉 **You're all set!** After following this guide, you'll have a production-ready, auto-scaling, zero-downtime deployment pipeline with full observability.