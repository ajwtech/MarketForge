# Custom CI image for MarketForge workflows
FROM pulumi/pulumi-nodejs-22:latest

# Enable Corepack (for Yarn 4+ support)
RUN corepack enable

# Install Yarn
RUN npm install -g yarn

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Install Docker CLI
RUN apt-get update && apt-get install -y docker.io

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*
