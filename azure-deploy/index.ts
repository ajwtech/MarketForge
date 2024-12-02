import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import * as docker from "@pulumi/docker";
import * as random from "@pulumi/random";

// import resources to manage
import { ResourceGroup } from "./infrastructure/resourceGroup";
import { subnet } from "./infrastructure/networking/subnet";
import { storageAccount, storageAccountKey, mauticAppFilesStorage } from "./infrastructure/storage/storageAccount";
import { logAnalyticsWorkspace } from "./infrastructure/logAnalytics/workspace"; 
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import { marketingcr, acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry";
import { mauticWeb, mauticCron, mauticWorker, mauticNginx, nginxUrl } from "./infrastructure/containerApps/mauticApps";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment"; // Import from managedEnvironment.ts

import { imageBuilds } from "./infrastructure/dockerImages"; // Ensure correct import

const config = new pulumi.Config();
const location = config.require("location");
const resourceGroupName = config.require("resourceGroupName");

type ACRSkuTier = keyof typeof azure_native.containerregistry.SkuName;
const acrSkuTier = (config.get("acrSkuTier") as ACRSkuTier) || "Basic";

const appVersion = config.get("appVersion") || "5.1.1";
const appEnv = config.get("appEnv") || "prod";
const dbHost = marketing_mysql.fullyQualifiedDomainName;
const dbPort = config.get("dbPort") || "3306";
const dbName = config.get("dbName") || "mauticdb";
const dbUser = config.get("dbUser") || "mauticuser";
const dbPassword = config.requireSecret("dbPassword");
// Generate a random appSecret if not provided in config
const appSecret = config.get("appSecret") || new random.RandomPassword("appSecret", {
    length: 32,
    special: true,
}).result;


const storageAccountName = config.require("storageAccountName");

// Update the StorageAccount resource to use the configurable storageAccountName
const ipAddressOrRange = config.get("ipAddressOrRange");


// Retrieve the Log Analytics shared key
const logAnalyticsSharedKey = pulumi.all([resourceGroupName, logAnalyticsWorkspace.name]).apply(([rgName, workspaceName]) =>
    azure_native.operationalinsights.getSharedKeys({
        resourceGroupName: rgName,
        workspaceName: workspaceName,
    }).then(keys => keys.primarySharedKey)
);

// Export the Log Analytics workspace ID
export const logAnalyticsWorkspaceId = logAnalyticsWorkspace.id;


// Export 'imageTag'
export { imageTag };

// Export 'marketing_env'
export { marketing_env };

// Create storage configuration in the managed environment
const storage = new azure_native.app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: ResourceGroup.name,
    storageName: "mautic-app-files",
    properties: {
        azureFile: {
            accountName: storageAccount.name,
            shareName: mauticAppFilesStorage.name,
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, {
    protect: true,
});

// Make imageTag configurable
const imageTag = config.get("imageTag") || "latest"; 


// Deploy the Mautic Nginx App
const mauticNginxApp = mauticNginx;
// Capture the nginx server URL with type annotation
const siteUrl = nginxUrl.apply((url: string | undefined) => url ? `https://${url}` : ""); 

// Deploy the Mautic Web App
const mauticWebApp = mauticWeb({
    env: appEnv,
    image: imageBuilds["marketing-mautic_web"].imageName, 
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: storage.name, 
    storageMountPath: "/var/www/html",
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    appSecret: appSecret,
    resourceGroupName: ResourceGroup.name, 
});

// Deploy the Mautic Cron Job
const mauticCronApp = mauticCron({
    env: appEnv,
    image: imageBuilds["marketing-mautic_cron"].imageName,
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: storage.name, 
    storageMountPath: "/var/www/html",
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    appSecret: appSecret,
    resourceGroupName: ResourceGroup.name,
    storageAccountKey: storageAccountKey, 
});

// Deploy the Mautic Worker
const mauticWorkerApp = mauticWorker({
    env: appEnv,
    image: imageBuilds["marketing-mautic_worker"].imageName,
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: storage.name,
    storageMountPath: "/var/www/html",
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    appSecret: appSecret,
    resourceGroupName: ResourceGroup.name,
});

// Export the URLs or necessary outputs
export const cronAppStatus = mauticCronApp.provisioningState; 
export const workerAppStatus = mauticWorkerApp.provisioningState; 

