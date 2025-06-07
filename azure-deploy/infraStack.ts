// Infrastructure stack (storage, managed env, DB, etc.)
import { storageAccountKey, mauticAppFilesStorage, suiteCrmAppFilesStorage, strapiAppFilesStorage, jumpboxFilesStorage, storageAccountName, frontendFilesStorage } from "./infrastructure/storage/storageAccount";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment";
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import * as pulumi from "@pulumi/pulumi";
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

export const suitecrmStorage = new azure_app.ManagedEnvironmentsStorage("suitecrm-app-files", {
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

export const jumpboxStorage = new azure_app.ManagedEnvironmentsStorage("jumpbox-files", {
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
const marketing_env_name = marketing_env.name;
const marketing_env_id = marketing_env.id;
const marketing_mysql_fqdn = marketing_mysql.fullyQualifiedDomainName; // <-- Add this line to export the MySQL FQDN
const mauticStorage_name = mauticStorage.name;
const strapiStorage_name = strapiStorage.name;
const suitecrmStorage_name = suitecrmStorage.name;
const jumpboxStorage_name = jumpboxStorage.name;
const storageAccountName_value = storageAccountName;
const storageAccountKey_value = storageAccountKey;

// Async function to return plain string outputs for stack references
export async function returnOutputs() {
    // Await all outputs to resolve to plain values
    const [
        marketing_env_name_val,
        marketing_env_id_val,
        marketing_mysql_fqdn_val, // <-- Add this
        mauticStorage_name_val,
        strapiStorage_name_val,
        suitecrmStorage_name_val,
        jumpboxStorage_name_val,
        storageAccountName_val,
        storageAccountKey_val
    ] = await Promise.all([
        marketing_env_name,
        marketing_env_id,
        marketing_mysql_fqdn, // <-- Add this
        mauticStorage_name,
        strapiStorage_name,
        suitecrmStorage_name,
        jumpboxStorage_name,
        storageAccountName_value,
        storageAccountKey_value
    ].map(async v => (typeof v === 'object' && 'apply' in v) ? await v : v));

    return {
        marketing_env_id: marketing_env_id_val,
        marketing_env_name: marketing_env_name_val,
        marketing_mysql_fqdn: marketing_mysql_fqdn_val, // <-- Add this
        mauticStorage_name: mauticStorage_name_val,
        strapiStorage_name: strapiStorage_name_val,
        suitecrmStorage_name: suitecrmStorage_name_val,
        jumpboxStorage_name: jumpboxStorage_name_val,
        storageAccountName: storageAccountName_val,
        storageAccountKey: storageAccountKey_val
    };
}

