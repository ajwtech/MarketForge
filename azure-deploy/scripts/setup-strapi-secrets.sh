#!/bin/bash

# Script to set up Strapi secrets for Pulumi deployment
# Run this from the azure-deploy directory

###############################
###############################
#####THIS NEEDS TO BE UPDATED TO SET THE CONFIG IN ESC 
###############################
###############################

echo "Setting up Strapi secrets for Pulumi..."

# Generate random secrets if not already set
JWT_SECRET=$(openssl rand -base64 32)
ADMIN_JWT_SECRET=$(openssl rand -base64 32)
APP_KEYS=$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32)
API_TOKEN_SALT=$(openssl rand -base64 16)
TRANSFER_TOKEN_SALT=$(openssl rand -base64 16)

echo "Setting Strapi secrets in Pulumi config..."

# Set the secrets
pulumi config set --secret jwtSecret "$JWT_SECRET"
pulumi config set --secret adminJwtSecret "$ADMIN_JWT_SECRET"
pulumi config set --secret appKeys "$APP_KEYS"
pulumi config set --secret apiTokenSalt "$API_TOKEN_SALT"
pulumi config set --secret transferTokenSalt "$TRANSFER_TOKEN_SALT"

echo "Secrets have been set successfully!"
echo ""
echo "You can now run: pulumi up"
echo ""
echo "If you need to check what secrets are set, run:"
echo "pulumi config"
