#!/bin/bash
# Grafana Cloud Endpoint Verification Script

echo "=== Grafana Cloud Connection Test ==="
echo ""

# Get the tokens from Kubernetes secret
echo "Getting tokens from Kubernetes secret..."
PROMETHEUS_TOKEN=$(kubectl get secret grafana-tokens -n kanni-ai -o jsonpath='{.data.prometheus-token}' | base64 -d)
LOKI_TOKEN=$(kubectl get secret grafana-tokens -n kanni-ai -o jsonpath='{.data.loki-token}' | base64 -d)

echo "Tokens retrieved successfully"
echo ""

# Test Prometheus endpoint
echo "Testing Prometheus endpoint..."
PROMETHEUS_ENDPOINT="https://prometheus-prod-65-prod-eu-west-2.grafana.net/api/prom/push"

# Test with basic auth (instance ID as username)
curl -X POST \
  -u "2737163:$PROMETHEUS_TOKEN" \
  -H "Content-Type: application/x-protobuf" \
  --max-time 10 \
  "$PROMETHEUS_ENDPOINT" \
  -d "" \
  -v

echo ""
echo "=== Instructions ==="
echo "1. Replace 'YOUR_PROMETHEUS_ENDPOINT_HERE' with your actual Grafana Cloud Prometheus endpoint"
echo "2. Replace 'YOUR_LOKI_ENDPOINT_HERE' with your actual Grafana Cloud Loki endpoint"  
echo "3. Run this script to test connectivity"
echo ""
echo "Expected response: HTTP 400 (bad request) is OK - it means authentication worked"
echo "HTTP 401 = authentication failed"
echo "HTTP 404 = wrong endpoint URL"
echo "Timeout = network/DNS issue"