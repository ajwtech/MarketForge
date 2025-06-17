# Build stage
FROM pulumi/pulumi-nodejs-22:latest AS builder

# Set working directory
WORKDIR /app

# Enable Corepack (Yarn 4+)
RUN corepack enable

# Install build dependencies
RUN apt-get update && \
    apt-get install -y \
      build-essential \
      python3 \
      python3-pip \
      git \
      pkg-config \
      libvips-dev \
      libsqlite3-dev \
      make \
      g++ \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy package files and workspace structure
COPY package.json .yarnrc.yml yarn.lock ./
COPY .yarn/ .yarn/

# Copy workspace package.json files with proper directory structure
COPY azure-deploy/package.json azure-deploy/package.json
COPY launchpad/package.json launchpad/package.json
COPY launchpad/strapi/package.json launchpad/strapi/package.json
COPY launchpad/next/package.json launchpad/next/package.json
COPY suitecrm/SuiteCRM-Core/package.json suitecrm/SuiteCRM-Core/package.json

# Copy workspace tsconfig files if they exist (needed for TypeScript resolution)
COPY azure-deploy/tsconfig.json azure-deploy/tsconfig.json
COPY launchpad/strapi/tsconfig.json launchpad/strapi/tsconfig.json
COPY launchpad/next/tsconfig.json launchpad/next/tsconfig.json
COPY suitecrm/SuiteCRM-Core/tsconfig.json suitecrm/SuiteCRM-Core/tsconfig.json

# Install dependencies
RUN corepack prepare --activate
RUN yarn install --immutable --immutable-cache

# Copy source code after dependencies are installed
COPY azure-deploy/ azure-deploy/
COPY tsconfig.json ./

# Production stage
FROM pulumi/pulumi-nodejs-22:latest AS production

# Set working directory to GitHub Actions workspace
WORKDIR /github/workspace

# Enable Corepack (Yarn 4+)
RUN corepack enable

# Install runtime dependencies only
RUN apt-get update && \
    apt-get install -y \
      docker.io \
      curl \
      git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Explicitly install Docker Buildx
RUN mkdir -p /usr/libexec/docker/cli-plugins && \
    BUILDX_VERSION=v0.14.0 && \
    curl -sSL https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}/buildx-${BUILDX_VERSION}.linux-amd64 \
    -o /usr/libexec/docker/cli-plugins/docker-buildx && \
    chmod +x /usr/libexec/docker/cli-plugins/docker-buildx

# Explicitly install Docker Compose Plugin (v2)
RUN COMPOSE_VERSION=v2.27.1 && \
    curl -SL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
    -o /usr/libexec/docker/cli-plugins/docker-compose && \
    chmod +x /usr/libexec/docker/cli-plugins/docker-compose

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Clone the repository to have the base structure
ARG GITHUB_REPO=ajwtech/marketforge
RUN git clone https://github.com/${GITHUB_REPO}.git . && \
    rm -rf .git

# Copy only the built dependencies from builder stage
# Everything else (source code, config files) comes from the git clone above
COPY --from=builder /app/node_modules ./node_modules