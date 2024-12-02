# Infrastructure Deployment

This document provides the steps required to launch the infrastructure using Pulumi.

## Prerequisites

1. **Pulumi CLI**: Ensure you have the Pulumi CLI installed. You can download it from [Pulumi's official website](https://www.pulumi.com/docs/get-started/install/).
2. **Azure CLI**: Ensure you have the Azure CLI installed. You can download it from [Microsoft's official website](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli).
3. **Node.js**: Ensure you have Node.js installed. You can download it from [Node.js official website](https://nodejs.org/).

## Configuration

1. **Azure Authentication**: Login to your Azure account using the Azure CLI.
    ```sh
    az login
    ```

2. **Set Configuration Values**: Choose one of the following methods to set your configuration values.

   **Option A: Using Stack Configuration File**

   - Create the `config` directory if it doesn't exist:
     ```sh
     mkdir config
     ```
   - Copy and edit the stack configuration file:
     ```sh
     cp Pulumi.marketing.yaml.template config/Pulumi.<stack-name>.yaml
     ```
   - Replace `<stack-name>` with your actual stack name (e.g., `marketing`).
   - Edit `config/Pulumi.<stack-name>.yaml` and fill in the required values.

   **Option B: Using `pulumi config set` Commands**

   - Set the configuration values using the following commands:
     ```sh
     pulumi config set azure-native:location EastUS2
     pulumi config set location EastUS
     pulumi config set resourceGroupName marketing-stack
     pulumi config set acrSkuName Basic
     pulumi config set appEnv prod
     pulumi config set appVersion 5.1.1
     pulumi config set dbName mauticdb
     pulumi config set dbUser mauticuser
     pulumi config set --secret dbPassword <Database Password>
     pulumi config set dbPort "3306"
     pulumi config set mysqlServerName marketing-mysql
     pulumi config set --secret mysqlAdminUser <MySQL Admin User>
     pulumi config set --secret mysqlAdminPassword <MySQL Admin Password>
     pulumi config set mysqlSkuName Standard_B1ms
     pulumi config set mysqlSkuTier Burstable
     pulumi config set ipAddressOrRange <IP Address or Range>
     pulumi config set subnetAddressPrefix 10.0.0.0/23
     pulumi config set subnetName marketing-subnet
     pulumi config set vnetAddressPrefixes "10.0.0.0/16"
     pulumi config set vnetName marketing-vnet
     pulumi config set storageAccountName marketingstackstorage
     pulumi config set pulumi:tags "{\"pulumi:template\":\"azure-typescript\"}"
     ```
     - Ensure that any secrets are set with the `--secret` flag.

## Deployment

1. **Select or Create a Stack**:

   - To create a new stack or select an existing one:
     ```sh
     pulumi stack init <stack-name>
     ```
     - Replace `<stack-name>` with your stack name (e.g., `marketing`).

2. **Deploy the Infrastructure**:

   - Run:
     ```sh
     pulumi up
     ```

## Cleanup

To destroy the infrastructure and clean up resources, run:
```sh
pulumi destroy
