import * as pulumi from "@pulumi/pulumi";
import * as dockerbuild from "@pulumi/docker-build";
import * as random from "@pulumi/random";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";


// import resources to manage
import { ResourceGroup } from "./infrastructure/resourceGroup";
import { 
    storageAccount, 
    storageAccountKey, 
    mauticAppFilesStorage, 
    suiteCrmAppFilesStorage, 
    strapiAppFilesStorage, 
    jumpboxFilesStorage,
    frontendFilesStorage 
} from "./infrastructure/storage/storageAccount";
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import { acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry";
import { mauticWeb, mauticNginx } from "./infrastructure/containerApps/mauticApps";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment"; // Import from managedEnvironment.ts
import { imageBuilds } from "./infrastructure/dockerImages"; // Ensure correct import
import { strapiApp } from "./infrastructure/containerApps/strapiApp"; // Import strapiApp
import { suitecrmApp } from "./infrastructure/containerApps/suiteCrmApp"; // Import suitecrmApp
import { setupDns } from "./infrastructure/dns/customDomains";
import { nginxCerts } from "./infrastructure/certificates/nginxCerts";
import { jumpBox as jumpbox } from "./infrastructure/containerApps/jumpbox"; // Import jumpbox deployment function


const config = new pulumi.Config();

const appEnv = config.get("appEnv") || "prod";
const dbHost = marketing_mysql.fullyQualifiedDomainName;
const dbPort = config.get("dbPort") || "3306";
const dbName = config.get("dbName") || "mauticdb";
const dbType = config.get("dbType") || "mysqli";
const dbVersion = config.get("dbVersion") || "8.0";
const dbCharset = config.get("dbCharset") || "utf8mb4";
const strapiDbName = config.get("strapiDbName") || "strapi";
const suitecrmDbName = config.get("suitecrmDbName") || "suitecrm";
const dbUser = config.get("dbUser") || config.get("mysqlAdminUser") || "mySqlAdmin";
const dbPassword = config.requireSecret("dbPassword");
const appSecret = config.get("appSecret") || new random.RandomPassword("appSecret", {length: 32, special: true,}).result;
const storageAccountName = config.require("storageAccountName");
const domain = config.require("domain");
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const crmSubdomain = config.get("crmSubdomain") || "crm";
const mapSubdomain = config.get("mapSubdomain") || "map";
const BoolSubdomains = config.getBoolean("createSubdomains") || false;
let createSubdomains: pulumi.Output<boolean> = pulumi.output(false).apply(unwrapped => unwrapped);  //do not change this value it always needs to be false for the initial deployment

// // Define Azure Function URL for frontend dynamic content
// const azureFunctionUrl = config.get("azureFunctionUrl") || "frontend-app";

// Create storage configuration in the managed environment for Mautic (uses marketingstacksa)
const mauticStorage = new azure_app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: ResourceGroup.name,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: mauticAppFilesStorage.name, // e.g. "mautic-app-files"
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    }, 
}, {
    protect: false,
    dependsOn: [mauticAppFilesStorage],
});

// Create dedicated storage for Strapi
const strapiStorage = new azure_app.ManagedEnvironmentsStorage("strapi-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: ResourceGroup.name,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: strapiAppFilesStorage.name, // "strapi-app-files"
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [strapiAppFilesStorage] });

// Create dedicated storage for SuiteCRM (also in marketingstacksa)
const suitecrmStorage = new azure_app.ManagedEnvironmentsStorage("suitecrm-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: ResourceGroup.name,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: suiteCrmAppFilesStorage.name, // e.g. "suitecrm-app-files"
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [suiteCrmAppFilesStorage] });

// Create dedicated storage for Jumpbox
const jumpboxStorage = new azure_app.ManagedEnvironmentsStorage("jumpbox-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: ResourceGroup.name,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: jumpboxFilesStorage.name, // "jumpbox-files"
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [jumpboxFilesStorage] });

// Create dedicated storage for frontend files
const frontendStorage = new azure_app.ManagedEnvironmentsStorage("frontend-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: ResourceGroup.name,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: frontendFilesStorage.name,
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [frontendFilesStorage] });

// Make imageTag configurable
const imageTag = config.get("imageTag") || "latest"; 

// Function to get the image name from imageBuilds or return the existing image name
function getImageName(imageBuilds: { [key: string]: dockerbuild.Image }, imageName: string): pulumi.Output<string> {
    return imageBuilds[imageName] ? imageBuilds[imageName].tags.apply(tags => tags ? tags[0] : "") : pulumi.interpolate`${registryUrl}/${imageName}:${imageTag}`;
}

// Deploy the Mautic Nginx App
export const mauticNginxApp = mauticNginx({
    env: appEnv,
    image: getImageName(imageBuilds, "marketing-nginx"),
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: mauticStorage.name,
    suiteCrmStorageName: suitecrmStorage.name,
    frontendStorageName: frontendStorage.name, 
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    resourceGroupName: ResourceGroup.name,
    createSubdomains: createSubdomains, // Set to false for initial deployment
    // azureFunctionUrl: azureFunctionUrl, 
});

const siteFQDN = mauticNginxApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost");
const nginxCvid = mauticNginxApp.customDomainVerificationId.apply(cvid => cvid);

// Deploy the Mautic Web App
export const mauticWebApp = mauticWeb({
    env: appEnv,
    image: getImageName(imageBuilds, "marketing-mautic-app"),
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: mauticStorage.name, 
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    appSecret: appSecret,
    resourceGroupName: ResourceGroup.name, 
    siteFQDN: siteFQDN,
    siteUrl: pulumi.interpolate`https://${mapSubdomain}.${domain}/`,
});

// Deploy the Strapi App using the dedicated strapi storage mount
export const deployedStrapiApp = strapiApp({
    env: appEnv,
    image: getImageName(imageBuilds, "marketing-strapi-app"),
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: strapiStorage.name, // Use the new Strapi storage mount
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: strapiDbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    dbClient: config.require("dbClient"),
    jwtSecret: config.require("jwtSecret"),
    adminJwtSecret: config.require("adminJwtSecret"),
    appKeys: config.require("appKeys"),
    nodeEnv: config.require("nodeEnv"),
    resourceGroupName: ResourceGroup.name,
    apiToken: config.require("apiToken"),
});

// Deploy the suitecrm App
export const deployedSuitecrmApp = suitecrmApp({
    env: appEnv,
    appSecret: appSecret,
    siteFQDN: siteFQDN,
    image: getImageName(imageBuilds, "marketing-suitecrm-app"),
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: suitecrmStorage.name,  // Use the SuiteCRM storage mount
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: suitecrmDbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    dbType: dbType,
    dbVersion: dbVersion,
    dbCharset: dbCharset,
    resourceGroupName: ResourceGroup.name,
    siteUrl: pulumi.interpolate`https://${crmSubdomain}.${domain}/`,
    crmSubdomain: crmSubdomain,
    domain: domain,
});


export const cloudflareDNSentries = BoolSubdomains ? setupDns({
    domain: domain,
    cmsSubdomain: cmsSubdomain,
    crmSubdomain: crmSubdomain,
    mapSubdomain: mapSubdomain,
    siteFQDN: siteFQDN,
    nginxCvid: nginxCvid,
    mauticNginxApp: mauticNginxApp,
    strapiApp: deployedStrapiApp,
    strapiFQDN: deployedStrapiApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost"),
    suiteCrmApp: deployedSuitecrmApp,
    suiteCrmFQDN: deployedSuitecrmApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost"),
}) : undefined ; // Set to undefined if BoolSubdomains is false

// Update mauticNginxApp to use the cloudflareDNSentries as the customDomains
export const customDomains = nginxCerts(mauticNginxApp, deployedStrapiApp,  marketing_env, cloudflareDNSentries);

// // Deploy the Jumpbox container app
// export const jumpboxApp = jumpbox({
//     env: appEnv,
//     managedEnvironmentId: marketing_env.id,
//     storageName: jumpboxStorage.name,  // Updated to use jumpbox storage
//     dbHost: dbHost,
//     dbPort: dbPort,
//     resourceGroupName: ResourceGroup.name,
// });


