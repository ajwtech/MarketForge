// Infrastructure stack (storage, managed env, DB, etc.)
import { storageAccountKey, mauticAppFilesStorage, suiteCrmAppFilesStorage, strapiAppFilesStorage, jumpboxFilesStorage, storageAccountName, frontendFilesStorage } from "./infrastructure/storage/storageAccount";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment";
export { marketing_mysql } from "./infrastructure/database/mysqlServer";
import * as pulumi from "@pulumi/pulumi";
import { getStackRefName } from "./utils/stackRef";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { acr } from "./stackRefs";

const config = new pulumi.Config();

// Reference the resource group from the ACR infra stack
export const resourceGroupName = acr.getOutput("resourceGroupName");

// ManagedEnvironmentsStorage resources for each file share
export const mauticStorage = new azure_app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: resourceGroupName,
    properties: {    
        azureFile: {
            accountName: storageAccountName,
            shareName: mauticAppFilesStorage.name,
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [mauticAppFilesStorage, marketing_env] });

export const strapiStorage = new azure_app.ManagedEnvironmentsStorage("strapi-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: resourceGroupName,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: strapiAppFilesStorage.name,
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [strapiAppFilesStorage, marketing_env] });

export const suitecrmStorage = new azure_app.ManagedEnvironmentsStorage("suitecrm-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: resourceGroupName,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: suiteCrmAppFilesStorage.name,
            accessMode: "ReadWrite",
        accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [suiteCrmAppFilesStorage, marketing_env] });

export const jumpboxStorage = new azure_app.ManagedEnvironmentsStorage("jumpbox-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: resourceGroupName,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: jumpboxFilesStorage.name,
        accessMode: "ReadWrite",
        accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [jumpboxFilesStorage, marketing_env] });

export const frontendStorage = new azure_app.ManagedEnvironmentsStorage("frontend-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: resourceGroupName,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: frontendFilesStorage.name,
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [frontendFilesStorage, marketing_env] });

// Exporting required values directly
export const marketing_env_name = marketing_env.name;
export const mauticStorage_name = mauticStorage.name;
export const strapiStorage_name = strapiStorage.name;
export const suitecrmStorage_name = suitecrmStorage.name;
export const jumpboxStorage_name = jumpboxStorage.name;
export const storageAccountName_value = storageAccountName;
export const storageAccountKey_value = storageAccountKey;


