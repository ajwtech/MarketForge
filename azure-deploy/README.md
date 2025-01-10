# MarketForge Azure Deployment

This repository contains the infrastructure code for deploying MarketForge using Pulumi and Azure.

## Prerequisites

1. **Install Pulumi**: Follow the instructions on the [Pulumi website](https://www.pulumi.com/docs/get-started/install/) to install Pulumi.
2. **Install Node.js**: Ensure you have Node.js installed. You can download it from [nodejs.org](https://nodejs.org/).
3. **Install Docker**: Ensure Docker is installed and running on your machine. You can download it from [docker.com](https://www.docker.com/).
4. **Azure CLI**: Install the Azure CLI from [docs.microsoft.com](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli).

## Setup

1. **Clone the repository**:
    ```sh
    git clone https://github.com/yourusername/MarketForge.git
    cd MarketForge/azure-deploy
    ```

2. **Install dependencies**:
    ```sh
    npm install
    ```

3. **Configure Pulumi**:
    ```sh
    pulumi login
    pulumi stack init dev
    ```

4. **Set configuration values**:
    ```sh
    pulumi config set marketing:location <your-azure-location>
    pulumi config set --secret marketing:subscriptionId <your-azure-subscription-id>
    pulumi config set --secret marketing:dbPassword <your-db-password>
    pulumi config set marketing:storageAccountName <your-storage-account-name>
    pulumi config set marketing:resourceGroupName <your-resource-group-name>
    pulumi config set --secret marketing:mysqlAdminPassword <your-mysql-admin-password>
    pulumi config set marketing:mysqlAdminUser <your-mysql-admin-password>
    pulumi config set marketing:mysqlServerName <your-mysqlServerName>
    pulumi config set marketing:mysqlSkuName <value> [size names and tiers](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/bv1-series?tabs=sizebasic)
    pulumi config set marketing:mysqlSkuTier <Burstable, GeneralPurpose, MemoryOptimized>
    ```

## Deployment

1. **Build Docker images**:
    ```sh
    pulumi up
    ```

2. **Verify deployment**:
    After the deployment is complete, you can verify the resources in the Azure portal.

## Cleanup

To clean up the resources created by Pulumi, run:
```sh
pulumi destroy
pulumi stack rm
```

## Futures Notes

- Ensure that your Azure CLI is authenticated with the correct subscription.
- The `imageTag` configuration can be set to specify a different tag for Docker images.
- The `appEnv` configuration can be set to specify the environment (e.g., `dev`, `prod`).

For more detailed information, refer to the Pulumi and Azure documentation.
