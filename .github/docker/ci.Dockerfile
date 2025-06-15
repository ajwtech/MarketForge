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
WORKDIR /app
# Copy your package files
COPY package.json .yarnrc.yml yarn.lock .nx/ .yarn/ ./
COPY launchpad/package.json  ./launchpad/
COPY launchpad/next/package.json ./launchpad/next/
COPY launchpad/strapi/package.json ./launchpad/strapi/
COPY azure-deploy/package.json ./azure-deploy/
COPY suitecrm/SuiteCRM-Core/package.json suitecrm/SuiteCRM-Core/ .yarnrc.yml ./suitecrm/SuiteCRM-Core/

RUN corepack prepare --activate

RUN set -e && yarn install --immutable --immutable-cache
RUN set -e && cd azure-deploy && yarn install --immutable --immutable-cache  
RUN set -e && cd launchpad && yarn install --immutable --immutable-cache
RUN set -e && cd launchpad/next && yarn install --immutable --immutable-cache
RUN set -e && cd launchpad/strapi && yarn install --immutable --immutable-cache
RUN set -e && cd suitecrm/SuiteCRM-Core && yarn install --immutable --immutable-cache

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*