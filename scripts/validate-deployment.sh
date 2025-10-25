#!/bin/bash

# Deployment Validation Script for Kanni AI
echo "🚀 Starting deployment validation for Kanni AI..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if kubectl is configured
echo "1. Checking kubectl configuration..."
kubectl cluster-info > /dev/null 2>&1
print_status $? "kubectl is configured and connected to cluster"

# Check namespace
echo "2. Checking namespace..."
kubectl get namespace kanni-ai > /dev/null 2>&1
print_status $? "Namespace 'kanni-ai' exists"

# Check deployment status
echo "3. Checking deployment status..."
kubectl get deployment kanni-ai-app -n kanni-ai > /dev/null 2>&1
if [ $? -eq 0 ]; then
    READY_REPLICAS=$(kubectl get deployment kanni-ai-app -n kanni-ai -o jsonpath='{.status.readyReplicas}')
    DESIRED_REPLICAS=$(kubectl get deployment kanni-ai-app -n kanni-ai -o jsonpath='{.spec.replicas}')
    
    if [ "$READY_REPLICAS" = "$DESIRED_REPLICAS" ]; then
        print_status 0 "Deployment is ready ($READY_REPLICAS/$DESIRED_REPLICAS replicas)"
    else
        print_status 1 "Deployment not ready ($READY_REPLICAS/$DESIRED_REPLICAS replicas)"
    fi
else
    print_status 1 "Deployment 'kanni-ai-app' not found"
fi

# Check pods status
echo "4. Checking pods status..."
kubectl get pods -n kanni-ai -l app=kanni-ai --no-headers | while read line; do
    POD_NAME=$(echo $line | awk '{print $1}')
    POD_STATUS=$(echo $line | awk '{print $3}')
    
    if [ "$POD_STATUS" = "Running" ]; then
        print_status 0 "Pod $POD_NAME is running"
    else
        print_status 1 "Pod $POD_NAME is $POD_STATUS"
    fi
done

# Check service
echo "5. Checking service..."
kubectl get service kanni-ai-service -n kanni-ai > /dev/null 2>&1
print_status $? "Service 'kanni-ai-service' exists"

# Check ingress
echo "6. Checking ingress..."
kubectl get ingress kanni-ai-ingress -n kanni-ai > /dev/null 2>&1
if [ $? -eq 0 ]; then
    INGRESS_IP=$(kubectl get ingress kanni-ai-ingress -n kanni-ai -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [ -n "$INGRESS_IP" ]; then
        print_status 0 "Ingress has IP address: $INGRESS_IP"
    else
        print_warning "Ingress exists but no IP assigned yet (this may take a few minutes)"
    fi
else
    print_status 1 "Ingress 'kanni-ai-ingress' not found"
fi

# Check SSL certificate
echo "7. Checking SSL certificate..."
kubectl get managedcertificate kanni-ai-ssl-cert -n kanni-ai > /dev/null 2>&1
if [ $? -eq 0 ]; then
    CERT_STATUS=$(kubectl get managedcertificate kanni-ai-ssl-cert -n kanni-ai -o jsonpath='{.status.certificateStatus}')
    if [ "$CERT_STATUS" = "Active" ]; then
        print_status 0 "SSL certificate is active"
    else
        print_warning "SSL certificate status: $CERT_STATUS (may take up to 60 minutes)"
    fi
else
    print_status 1 "SSL certificate not found"
fi

# Check HPA
echo "8. Checking Horizontal Pod Autoscaler..."
kubectl get hpa kanni-ai-hpa -n kanni-ai > /dev/null 2>&1
print_status $? "HPA 'kanni-ai-hpa' exists"

# Check OpenTelemetry collector
echo "9. Checking OpenTelemetry collector..."
kubectl get opentelemetrycollector otel-collector -n kanni-ai > /dev/null 2>&1
if [ $? -eq 0 ]; then
    print_status 0 "OpenTelemetry collector exists"
else
    print_warning "OpenTelemetry collector not found (requires OTel operator)"
fi

# Test application endpoint
echo "10. Testing application endpoint..."
if command -v curl > /dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://kanni-ai.de --max-time 10)
    if [ "$HTTP_STATUS" = "200" ]; then
        print_status 0 "Application is accessible at https://kanni-ai.de"
    elif [ "$HTTP_STATUS" = "000" ]; then
        print_warning "Cannot reach https://kanni-ai.de (DNS/SSL may still be propagating)"
    else
        print_status 1 "Application returned HTTP $HTTP_STATUS"
    fi
else
    print_warning "curl not available, skipping endpoint test"
fi

# Resource usage check
echo "11. Checking resource usage..."
if command -v kubectl > /dev/null 2>&1; then
    kubectl top pods -n kanni-ai --no-headers 2>/dev/null | while read line; do
        POD_NAME=$(echo $line | awk '{print $1}')
        CPU=$(echo $line | awk '{print $2}')
        MEMORY=$(echo $line | awk '{print $3}')
        echo -e "${GREEN}📊 $POD_NAME: CPU=$CPU, Memory=$MEMORY${NC}"
    done
else
    print_warning "Metrics server not available for resource usage"
fi

echo ""
echo "🏁 Validation complete!"
echo ""
echo "If you see any issues above, check the logs with:"
echo "  kubectl logs -n kanni-ai deployment/kanni-ai-app"
echo ""
echo "To monitor the deployment:"
echo "  kubectl get pods -n kanni-ai -w"