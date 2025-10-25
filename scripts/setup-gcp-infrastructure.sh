#!/bin/bash

# GCP Infrastructure Setup Script for Kanni AI
# Run this script after setting your PROJECT_ID

# Set your project ID here
PROJECT_ID="lucky-antler-476111-g9"
echo "Setting up infrastructure for project: $PROJECT_ID"

# Set the project
gcloud config set project $PROJECT_ID

echo "Step 1: Enabling required APIs..."
gcloud services enable container.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable dns.googleapis.com

echo "Step 2: Using existing GKE cluster..."
echo "Skipping cluster creation - using existing cluster 'kanni-ai-poc' in europe-west1"

echo "Step 3: Creating service account for GitHub Actions..."
gcloud iam service-accounts create github-actions-sa \
  --display-name="GitHub Actions Service Account"

# Add necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.builder"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

echo "Step 4: Creating service account key..."
gcloud iam service-accounts keys create key.json \
  --iam-account=github-actions-sa@$PROJECT_ID.iam.gserviceaccount.com

echo "Step 5: Creating static IP for ingress..."
gcloud compute addresses create kanni-ai-ip --global

echo "Step 6: Getting static IP address..."
STATIC_IP=$(gcloud compute addresses describe kanni-ai-ip --global --format="value(address)")
echo "Your static IP address is: $STATIC_IP"

echo "Step 7: Setting up DNS zone..."
gcloud dns managed-zones create kanni-ai-zone \
  --dns-name="kanni-ai.de." \
  --description="DNS zone for kanni-ai.de"

echo "Step 8: Getting name servers for DNS configuration..."
echo "Configure these name servers in your domain registrar (Strato):"
gcloud dns managed-zones describe kanni-ai-zone --format="value(nameServers)"

echo "Step 9: Adding A record for domain..."
gcloud dns record-sets transaction start --zone=kanni-ai-zone
gcloud dns record-sets transaction add $STATIC_IP --name=kanni-ai.de. --ttl=300 --type=A --zone=kanni-ai-zone
gcloud dns record-sets transaction execute --zone=kanni-ai-zone

echo "Step 10: Getting cluster credentials..."
gcloud container clusters get-credentials kanni-ai-poc --region=europe-west1

echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Add the contents of key.json to GitHub secrets as GCP_SA_KEY"
echo "2. Add your project ID ($PROJECT_ID) to GitHub secrets as GCP_PROJECT_ID"
echo "3. Configure your domain's name servers with the DNS servers shown above"
echo "4. Update your Grafana Cloud tokens in GitHub secrets"
echo "5. Push your code to trigger the first deployment"

# Clean up the key file for security
echo "Cleaning up key file..."
rm key.json