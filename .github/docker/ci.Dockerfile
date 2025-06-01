# Custom CI image for MarketForge workflows

FROM docker/buildx-bin:latest AS buildx
FROM pulumi/pulumi-nodejs-22:latest

# Install Docker Buildx CLI plugin
COPY --from=buildx /buildx /usr/libexec/docker/cli-plugins/docker-buildx


# Enable Corepack (for Yarn 4+ support)
RUN corepack enable

# Install Azure CLI
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash

# Install Docker CLI
RUN apt-get update && apt-get install -y docker.io

# Install build tools for native modules
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    python3-setuptools \
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy package manager files and Yarn cache from workspace root
COPY package.json yarn.lock .yarn/ ./
COPY launchpad/package.json launchpad/yarn.lock launchpad/.yarn/ ./launchpad/
COPY launchpad/next/package.json launchpad/next/yarn.lock launchpad/next/.yarn/ ./launchpad/next/
COPY launchpad/strapi/package.json launchpad/strapi/yarn.lock launchpad/strapi/.yarn/ ./launchpad/strapi/
COPY azure-deploy/package.json azure-deploy/yarn.lock azure-deploy/.yarn/ ./azure-deploy/

# Pre-install dependencies
RUN yarn install --immutable

# Pre-install dependencies for azure-deploy
RUN cd azure-deploy && yarn install --immutable && cd ..

# Pre-install dependencies for launchpad, next, and strapi
RUN cd launchpad && yarn install --immutable && cd ..
RUN cd launchpad/next && yarn install --immutable && cd ../..
RUN cd launchpad/strapi && yarn install --immutable && cd ../..
