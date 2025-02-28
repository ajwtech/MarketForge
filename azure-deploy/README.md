# MarketForge Azure Deployment

This repository contains the infrastructure code for deploying MarketForge using Pulumi and Azure.

## Prerequisites

1. **Install Pulumi**: Follow the instructions on the [Pulumi website](https://www.pulumi.com/docs/get-started/install/) to install Pulumi.
2. **Install Node.js**: Ensure you have Node.js installed. You can download it from [nodejs.org](https://nodejs.org/).
3. **Install Docker**: Ensure Docker is installed and running on your machine. You can download it from [docker.com](https://www.docker.com/).
4. **Azure CLI**: Install the Azure CLI from [docs.microsoft.com](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli).
5. **Cloudflare Account**: You must have a Cloudflare account with an API token. The token should be configured as a secret in Pulumi.

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

3. **Log in and initialize Pulumi stack**:
    ```sh
    pulumi login
    pulumi stack init dev
    ```

4. **Set configuration values**:

   ### Required Configuration
   Configure the settings that do not have defaults:
    ```sh
    pulumi config set --secret marketing:subscriptionId <your-azure-subscription-id>
    pulumi config set --secret marketing:dbPassword <your-db-password>
    pulumi config set marketing:storageAccountName <your-storage-account-name>
    pulumi config set marketing:resourceGroupName <your-resource-group-name>
    pulumi config set --secret marketing:mysqlAdminPassword <your-mysql-admin-password>
    pulumi config set marketing:mysqlAdminUser <your-mysql-admin-user>
    pulumi config set marketing:mysqlServerName <your-mysqlServerName>
    pulumi config set marketing:mysqlSkuName <sku-name>
    pulumi config set marketing:mysqlSkuTier <sku-tier>
    pulumi config set marketing:mysqlDbName <your-mysql-db-name>
    pulumi config set marketing:domain <your-domain> 
    pulumi config set --secret cloudflare:apiToken <your-cloudflare-api-token>
    pulumi config set --secret marketing:adminJwtSecret <your-adminJwtSecret>
    pulumi config set --secret marketing:jwtSecret <your-jwtSecret>
    pulumi config set --secret marketing:appKeys <your-appKeys>
    pulumi config set marketing:apiToken <your-marketing-apiToken>
    pulumi config set marketing:dbClient mysql    # dbClient currently needs to be mysql
    ```

   ### Optional Configuration
    ```sh
    pulumi config set marketing:location <your-azure-location>
    pulumi config set marketing:appEnv <dev|prod>
    pulumi config set marketing:cmsSubdomain cms     # override defaults if needed
    pulumi config set marketing:crmSubdomain crm
    pulumi config set marketing:mapSubdomain map
    pulumi config set marketing:imageTag <your-image-tag>
    ```

5. **Note on Cloudflare**:  
   The Cloudflare API token is used to create DNS records for your application's custom domains. Ensure you have the token available in your environment or Pulumi's secure store. It will be referenced in code as `cloudflare:apiToken`.

## Deployment

1. **Build and deploy the infrastructure**:
    ```sh
    pulumi up
    ```

2. **Verify deployment**:
    After the deployment is complete, verify your resources in the Azure portal and check that Cloudflare DNS records have been created correctly.

## Cleanup

To clean up the resources created by Pulumi, run:
```sh
pulumi destroy
pulumi stack rm
```

## Additional Notes

- **Cloudflare DNS Records**: The deployment creates both CNAME and TXT records in Cloudflare for domain verification. If you need to adjust the record types or values, refer to the `customDomains.ts` file.
- **Secrets Management**: All sensitive configuration (API tokens, passwords, secret keys) is managed securely using Pulumi's secret mechanism.
- **Environment Specific Configs**: Use the corresponding config file (e.g., `Pulumi.test.yaml`) for different environments.

For more detailed information, refer to the Pulumi and Azure documentation.
