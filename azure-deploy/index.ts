import * as pulumi from "@pulumi/pulumi";
import * as dockerbuild from "@pulumi/docker-build";
import * as random from "@pulumi/random";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";


// import resources to manage
import { ResourceGroup } from "./infrastructure/resourceGroup";
import { storageAccount, storageAccountKey, mauticAppFilesStorage,  } from "./infrastructure/storage/storageAccount";
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import { acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry";
import { mauticWeb, mauticNginx } from "./infrastructure/containerApps/mauticApps";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment"; // Import from managedEnvironment.ts
import { imageBuilds } from "./infrastructure/dockerImages"; // Ensure correct import
import { strapiApp } from "./infrastructure/containerApps/strapiApp"; // Import strapiApp
// import { vtigerApp } from "./infrastructure/containerApps/vtigerApp"; // Import vtigerApp
import { setupDns } from "./infrastructure/dns/customDomains";
import { nginxCerts } from "./infrastructure/certificates/nginxCerts";
import { jumpBox as jumpbox } from "./infrastructure/containerApps/jumpbox"; // Import jumpbox deployment function


const config = new pulumi.Config();

const appEnv = config.get("appEnv") || "prod";
const dbHost = marketing_mysql.fullyQualifiedDomainName;
const dbPort = config.get("dbPort") || "3306";
const dbName = config.get("dbName") || "mauticdb";
const dbType = config.get("dbType") || "mysqli";
const strapiDbName = config.get("strapiDbName") || "strapi";
// const vTigerDbName = config.get("vTigerDbName") || "vtiger";
const dbUser = config.get("dbUser") || "mauticuser";
const dbPassword = config.requireSecret("dbPassword");
const appSecret = config.get("appSecret") || new random.RandomPassword("appSecret", {length: 32, special: true,}).result;
const storageAccountName = config.require("storageAccountName");
const domain = config.require("domain");
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const crmSubdomain = config.get("crmSubdomain") || "crm";
const mapSubdomain = config.get("mapSubdomain") || "map";
const BoolSubdomains = config.getBoolean("createSubdomains") || false;
let createSubdomains: pulumi.Output<boolean> = pulumi.output(false).apply(unwrapped => unwrapped);  //do not change this value it always needs to be false for the initial deployment

// Create storage configuration in the managed environment 
const storage = new azure_app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
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
    dependsOn: [mauticAppFilesStorage],
});

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
    storageName: storage.name,
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    resourceGroupName: ResourceGroup.name,
    createSubdomains: createSubdomains, // Set to false for initial deployment
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
    storageName: storage.name, 
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    dbUser: dbUser,
    dbPassword: dbPassword,
    appSecret: appSecret,
    resourceGroupName: ResourceGroup.name, 
    siteFQDN: siteFQDN,
});

// Deploy the Strapi App
export const deployedStrapiApp = strapiApp({
    env: appEnv,
    image: getImageName(imageBuilds, "marketing-strapi-app"),
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: storage.name,
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

// // Deploy the Vtiger App
// export const deployedVtigerApp = vtigerApp({
//     env: appEnv,
//     appSecret: appSecret,
//     siteFQDN: siteFQDN,
//     image: getImageName(imageBuilds, "marketing-vtiger-app"),
//     registryUrl: registryUrl,
//     registryUsername: acrUsername,
//     registryPassword: acrPassword,
//     managedEnvironmentId: marketing_env.id,
//     storageName: storage.name,
//     dbHost: dbHost,
//     dbPort: dbPort,
//     dbName: vTigerDbName,
//     dbUser: dbUser,
//     dbPassword: dbPassword,
//     dbType: dbType,
//     resourceGroupName: ResourceGroup.name,
//     siteUrl: pulumi.interpolate`http://${crmSubdomain}.${domain}`,
//     crmSubdomain: crmSubdomain,
//     domain: domain,
// });


const cloudflareDNSentries = BoolSubdomains? setupDns({
    domain: domain,
    cmsSubdomain: cmsSubdomain,
    crmSubdomain: crmSubdomain,
    mapSubdomain: mapSubdomain,
    siteFQDN: siteFQDN,
    nginxCvid: nginxCvid,
    mauticNginxApp: mauticNginxApp,
    strapiApp: deployedStrapiApp,
    strapiFQDN: deployedStrapiApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost"),
    // vtigerApp: deployedVtigerApp,
    // vtigerFQDN: deployedVtigerApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost"),
}): undefined; // Set to undefined if BoolSubdomains is false

// Update mauticNginxApp to use the cloudflareDNSentries as the customDomains
export const customDomains = nginxCerts(mauticNginxApp, deployedStrapiApp,  marketing_env ); // Set to true if subdomains need to be created

// Deploy the Jumpbox container app
export const jumpboxApp = jumpbox({
    env: appEnv,
    managedEnvironmentId: marketing_env.id,
    storageName: storage.name,
    dbHost: dbHost,
    dbPort: dbPort,
    resourceGroupName: ResourceGroup.name,
});


