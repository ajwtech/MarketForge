# MarketForge CI Container - Lean and optimized
FROM pulumi/pulumi-nodejs-22:latest

# Set working directory
WORKDIR /ci-workspace

# Enable Corepack (Yarn 4+)
RUN corepack enable

# Install essential CI tools
RUN apt-get update && \
    apt-get install -y \
      docker.io \
      curl \
      git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Docker Buildx
RUN mkdir -p /usr/libexec/docker/cli-plugins && \
    BUILDX_VERSION=v0.14.0 && \
    curl -sSL https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-amd64 \
    -o /usr/libexec/docker/cli-plugins/docker-buildx && \
    chmod +x /usr/libexec/docker/cli-plugins/docker-buildx

# Install Docker Compose Plugin (v2)
RUN COMPOSE_VERSION=v2.27.1 && \
    curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o /usr/libexec/docker/cli-plugins/docker-compose && \
    chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Set environment variables for CI
ENV NODE_ENV=production
ENV CI=true

# Validate the CI environment is properly set up
RUN yarn --version && \
    docker --version && \
    docker buildx version && \
    docker compose version && \
    az --version && \
    pulumi version

# Add labels for better container management
LABEL org.opencontainers.image.description="MarketForge CI Container with Pulumi, Docker, and Azure CLI"
LABEL org.opencontainers.image.source="https://github.com/ajwtech/marketforge"