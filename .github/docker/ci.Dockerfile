FROM pulumi/pulumi-nodejs-22:latest

# Enable Corepack (Yarn 4+)
RUN corepack enable

# Install Docker CLI, curl, build essentials, Python, and Git
RUN apt-get update && \
    apt-get install -y \
      docker.io \
      curl \
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
# Set workdir

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

# Copy all files (except those excluded by .dockerignore)
COPY . .

# Install dependencies once with proper workspace structure in place
RUN corepack prepare --activate
RUN set -e && yarn install --immutable --immutable-cache


# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*