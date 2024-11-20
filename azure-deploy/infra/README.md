# Infrastructure Deployment

This document provides the steps required to launch the infrastructure using Pulumi.

## Prerequisites

1. **Pulumi CLI**: Ensure you have the Pulumi CLI installed. You can download it from [Pulumi's official website](https://www.pulumi.com/docs/get-started/install/).
2. **Azure CLI**: Ensure you have the Azure CLI installed. You can download it from [Microsoft's official website](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli).
3. **Node.js**: Ensure you have Node.js installed. You can download it from [Node.js official website](https://nodejs.org/).

## Configuration

1. **Pulumi Configuration**: Copy the `Pulumi.test.yaml.template` to `Pulumi.test.yaml` and fill in the required values.
    ```sh
    cp Pulumi.test.yaml.template Pulumi.test.yaml
    ```

2. **Azure Authentication**: Login to your Azure account using the Azure CLI.
    ```sh
    az login
    ```

## Deployment

1. **Install Dependencies**: Navigate to the `azure-deploy/infra` directory and install the required dependencies.
    ```sh
    cd azure-deploy/infra
    npm install
    ```

2. **Pulumi Stack Initialization**: Initialize the Pulumi stack.
    ```sh
    pulumi stack init <stack-name>
    ```

3. **Pulumi Configuration**: Set the Pulumi configuration values.
    ```sh
    pulumi config set azure-native:location <Azure Location>
    pulumi config set infra:location <Infra Location>
    pulumi config set infra:resourceGroupName <Resource Group Name>
    pulumi config set infra:logAnalyticsCustomerId <Log Analytics Customer ID>
    pulumi config set --secret infra:logAnalyticsSharedKey <Log Analytics Shared Key>
    pulumi config set --secret infra:storageAccountKey <Storage Account Key>
    ```

4. **Deploy the Infrastructure**: Run the Pulumi up command to deploy the infrastructure.
    ```sh
    pulumi up
    ```

## Cleanup

To destroy the infrastructure and clean up resources, run:
```sh
pulumi destroy