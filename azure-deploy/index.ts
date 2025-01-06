import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import * as docker from "@pulumi/docker";
import * as random from "@pulumi/random";

// import resources to manage
import { ResourceGroup } from "./infrastructure/resourceGroup";
import { storageAccount, storageAccountKey, mauticAppFilesStorage, mauticStaticHosting } from "./infrastructure/storage/storageAccount";
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import { acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry";
import { mauticWeb, mauticNginx } from "./infrastructure/containerApps/mauticApps";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment"; // Import from managedEnvironment.ts
import { imageBuilds } from "./infrastructure/dockerImages"; // Ensure correct import

const config = new pulumi.Config();

//TODO: Re-enable this and add code to manage versions later
//const appVersion = config.get("appVersion") || "5.1.1";
const appEnv = config.get("appEnv") || "prod";
const dbHost = marketing_mysql.fullyQualifiedDomainName;
const dbPort = config.get("dbPort") || "3306";
const dbName = config.get("dbName") || "mauticdb";
const dbUser = config.get("dbUser") || "mauticuser";
const dbPassword = config.requireSecret("dbPassword");
const appSecret = config.get("appSecret") || new random.RandomPassword("appSecret", {length: 32, special: true,}).result;
const storageAccountName = config.require("storageAccountName");
// Create storage configuration in the managed environment 
const storage = new azure_native.app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: ResourceGroup.name,
    storageName: storageAccount.name,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: mauticAppFilesStorage.name,
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, {
    protect: false,
    dependsOn: [mauticAppFilesStorage]
});

//set the env var MAUTIC_STORAGE_STATIC_WEB to the static site container URN
const urnString = mauticStaticHosting.urn.apply(urnString  => {
    return urnString;
});


// Make imageTag configurable
const imageTag = config.get("imageTag") || "latest"; 

// Function to get the image name from imageBuilds or return the existing image name
function getImageName(imageBuilds: { [key: string]: docker.Image }, imageName: string): pulumi.Output<string> {
    return imageBuilds[imageName] ? imageBuilds[imageName].imageName : pulumi.interpolate`${registryUrl}/${imageName}:${imageTag}`;
}

// Deploy the Mautic Nginx App
export const mauticNginxApp = mauticNginx({
    env: appEnv,
    image: getImageName(imageBuilds, "marketing-nginx"),
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: storage.name,
    storageMountPath: "/var/www/html",
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    resourceGroupName: ResourceGroup.name,
    staticSiteContainer: urnString,
});

const siteURN = mauticNginxApp.urn
// Deploy the Mautic Web App
export const mauticWebApp = mauticWeb({
    env: appEnv,
    image: getImageName(imageBuilds, "marketing-mautic_web"),
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
    siteurn: siteURN,
});

// // Deploy the Mautic Cron Job
// const mauticCronApp = mauticCron({
//     env: appEnv,
//     image: getImageName(imageBuilds, "marketing-mautic_cron"),
//     registryUrl: registryUrl,
//     registryUsername: acrUsername,
//     registryPassword: acrPassword,
//     managedEnvironmentId: marketing_env.id,
//     storageName: storage.name, 
//     storageMountPath: "/var/www/html",
//     dbHost: dbHost,
//     dbPort: dbPort,
//     dbName: dbName,
//     dbUser: dbUser,
//     dbPassword: dbPassword,
//     appSecret: appSecret,
//     resourceGroupName: ResourceGroup.name,
//     storageAccountKey: storageAccountKey, 
// });

//Removed the below to try and figure out a better way to manage in Azure.
// Deploy the Mautic Worker
// const mauticWorkerApp = mauticWorker({
//     env: appEnv,
//     image: getImageName(imageBuilds, "marketing-mautic_worker"),
//     registryUrl: registryUrl,
//     registryUsername: acrUsername,
//     registryPassword: acrPassword,
//     managedEnvironmentId: marketing_env.id,
//     storageName: storage.name,
//     storageMountPath: "/var/www/html",
//     dbHost: dbHost,
//     dbPort: dbPort,
//     dbName: dbName,
//     dbUser: dbUser,
//     dbPassword: dbPassword,
//     appSecret: appSecret,
//     resourceGroupName: ResourceGroup.name,
// });