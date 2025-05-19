import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";


// import resources to manage
import { ResourceGroup } from "./infrastructure/resourceGroup";
import { 
    storageAccountKey, 
    mauticAppFilesStorage, 
    suiteCrmAppFilesStorage, 
    strapiAppFilesStorage, 
    jumpboxFilesStorage,
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
const domain = config.require("domain");
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const crmSubdomain = config.get("crmSubdomain") || "crm";
const mapSubdomain = config.get("mapSubdomain") || "map";
const BoolSubdomains = config.getBoolean("createSubdomains") || false;
const imageTag = config.get("imageTag") || "latest"; 
let createSubdomains: pulumi.Output<boolean> = pulumi.output(false).apply(unwrapped => unwrapped);  //do not change this value it always needs to be false for the initial deployment

// While these are used in this file, they were only exported for the github actions to use
export const storageAccountName = config.require("storageAccountName");
export const resourceGroupName = ResourceGroup.name;

// Export ACR outputs for GitHub Actions (must be top-level, not inside switch)
export const acrUsernameOut = process.env.GITHUB_JOB === "setup-acr-infra" ? acrUsername : undefined;
export const acrPasswordOut = process.env.GITHUB_JOB === "setup-acr-infra" ? acrPassword : undefined;
export const registryUrlOut = process.env.GITHUB_JOB === "setup-acr-infra" ? registryUrl : undefined;

// // Define Azure Function URL for frontend dynamic content
// const azureFunctionUrl = config.get("azureFunctionUrl") || "frontend-app";

// Create storage configuration in the managed environment for Mautic (uses marketingstacksa)
const mauticStorage = new azure_app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: jumpboxFilesStorage.name, // "jumpbox-files"
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [jumpboxFilesStorage] });



// Function to get the image name from the registry
function getImageName(imageName: string): pulumi.Output<string> {
    return registryUrl.apply(url => `${url}/${imageName}:${imageTag}`);
}

// Remove all app deployment from global context. Only define in setup-apps/default cases.
const githubJob = process.env.GITHUB_JOB;

switch (githubJob) {
  case "setup-acr-infra": {
    // Only create ACR and its dependencies, and output creds
    // ResourceGroup and ACR registry are always needed
    // Export acrUsername, acrPassword, registryUrl
    // (Exports moved to top-level for TypeScript compatibility)
    break;
  }
  case "setup-infra": {
    // Create all remaining infrastructure except container apps
    // This includes storage, managed environment, databases, etc.
    // Do not create container apps or build/push images here
    // Create storage configuration in the managed environment for Mautic (uses marketingstacksa)
const mauticStorage = new azure_app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: jumpboxFilesStorage.name, // "jumpbox-files"
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [jumpboxFilesStorage] });

    break;
  }
  case "setup-apps": {
    // Only deploy container apps, DNS, certs, jumpbox
    // Deploy the Mautic Nginx App
    const mauticNginxApp = mauticNginx({
        env: appEnv,
        image: getImageName("marketing-nginx"),
        registryUrl: registryUrl,
        registryUsername: acrUsername,
        registryPassword: acrPassword,
        managedEnvironmentId: marketing_env.id,
        storageName: pulumi.output("mautic-app-files-storage"),
        suiteCrmStorageName: pulumi.output("suitecrm-app-files-storage"),
        dbHost: dbHost,
        dbPort: dbPort,
        dbName: dbName,
        resourceGroupName: resourceGroupName,
        createSubdomains: createSubdomains, // Set to false for initial deployment
        // azureFunctionUrl: azureFunctionUrl, 
    });

    const siteFQDN = mauticNginxApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost");
    const nginxCvid = mauticNginxApp.customDomainVerificationId.apply(cvid => cvid);

    // Deploy the Mautic Web App
    const mauticWebApp = mauticWeb({
        env: appEnv,
        image: getImageName("marketing-mautic-app"),
        registryUrl: registryUrl,
        registryUsername: acrUsername,
        registryPassword: acrPassword,
        managedEnvironmentId: marketing_env.id,
        storageName: pulumi.output("mautic-app-files-storage"),
        dbHost: dbHost,
        dbPort: dbPort,
        dbName: dbName,
        dbUser: dbUser,
        dbPassword: dbPassword,
        appSecret: appSecret,
        resourceGroupName: resourceGroupName, 
        siteFQDN: siteFQDN,
        siteUrl: pulumi.interpolate`https://${mapSubdomain}.${domain}/`,
    });

    // Deploy the Strapi App using the dedicated strapi storage mount
    const deployedStrapiApp = strapiApp({
        env: appEnv,
        image: getImageName("marketing-strapi-app"),
        registryUrl: registryUrl,
        registryUsername: acrUsername,
        registryPassword: acrPassword,
        managedEnvironmentId: marketing_env.id,
        storageName: pulumi.output("strapi-app-files-storage"),
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
        resourceGroupName: resourceGroupName,
        apiToken: config.require("apiToken"),
        transferTokenSalt: config.require("transferTokenSalt"),
        cmsUrl: pulumi.interpolate`https://${cmsSubdomain}.${domain}/`,
    });

    // Deploy the suitecrm App
    const deployedSuitecrmApp = suitecrmApp({
        env: appEnv,
        appSecret: appSecret,
        siteFQDN: siteFQDN,
        image: getImageName("marketing-suitecrm-app"),
        registryUrl: registryUrl,
        registryUsername: acrUsername,
        registryPassword: acrPassword,
        managedEnvironmentId: marketing_env.id,
        storageName: pulumi.output("suitecrm-app-files-storage"),
        dbHost: dbHost,
        dbPort: dbPort,
        dbName: suitecrmDbName,
        dbUser: dbUser,
        dbPassword: dbPassword,
        dbType: dbType,
        dbVersion: dbVersion,
        dbCharset: dbCharset,
        resourceGroupName: resourceGroupName,
        siteUrl: pulumi.interpolate`https://${crmSubdomain}.${domain}/`,
        crmSubdomain: crmSubdomain,
        domain: domain,
    });

    const cloudflareDNSentries = BoolSubdomains ? setupDns({
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
    }) : undefined; // Set to undefined if BoolSubdomains is false

    const customDomains = nginxCerts(mauticNginxApp, deployedStrapiApp, marketing_env, cloudflareDNSentries);

    // Deploy the Jumpbox container app
    const jumpboxApp = jumpbox({
        env: appEnv,
        managedEnvironmentId: marketing_env.id,
        storageName: pulumi.output("jumpbox-files-storage"),
        dbHost: dbHost,
        dbPort: dbPort,
        resourceGroupName: resourceGroupName,
    });

    // Export resources at the top-level for Pulumi stack outputs
    export { mauticNginxApp, mauticWebApp, deployedStrapiApp, deployedSuitecrmApp, cloudflareDNSentries, customDomains, jumpboxApp };
    break;
  }
  default: {
    // If not running in CI, or no GITHUB_JOB set, run everything (for local/dev)
    // Create storage configuration in the managed environment for Mautic (uses marketingstacksa)
const mauticStorage = new azure_app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
    environmentName: marketing_env.name,
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
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
    resourceGroupName: resourceGroupName,
    properties: {
        azureFile: {
            accountName: storageAccountName,
            shareName: jumpboxFilesStorage.name, // "jumpbox-files"
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
}, { protect: false, dependsOn: [jumpboxFilesStorage] });

// Function to get the image name from the registry
function getImageName(imageName: string): pulumi.Output<string> {
    return registryUrl.apply(url => `${url}/${imageName}:${imageTag}`);
}

// Deploy the Mautic Nginx App
export const mauticNginxApp = mauticNginx({
    env: appEnv,
    image: getImageName("marketing-nginx"),
    registryUrl: registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: mauticStorage.name,
    suiteCrmStorageName: suitecrmStorage.name,
    dbHost: dbHost,
    dbPort: dbPort,
    dbName: dbName,
    resourceGroupName: resourceGroupName,
    createSubdomains: createSubdomains, // Set to false for initial deployment
    // azureFunctionUrl: azureFunctionUrl, 
});

const siteFQDN = mauticNginxApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost");
const nginxCvid = mauticNginxApp.customDomainVerificationId.apply(cvid => cvid);

// Deploy the Mautic Web App
export const mauticWebApp = mauticWeb({
    env: appEnv,
    image: getImageName("marketing-mautic-app"),
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
    resourceGroupName: resourceGroupName, 
    siteFQDN: siteFQDN,
    siteUrl: pulumi.interpolate`https://${mapSubdomain}.${domain}/`,
});

// Deploy the Strapi App using the dedicated strapi storage mount
export const deployedStrapiApp = strapiApp({
    env: appEnv,
    image: getImageName("marketing-strapi-app"),
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
    resourceGroupName: resourceGroupName,
    apiToken: config.require("apiToken"),
    transferTokenSalt: config.require("transferTokenSalt"),
    cmsUrl: pulumi.interpolate`https://${cmsSubdomain}.${domain}/`,
});


// Deploy the suitecrm App
export const deployedSuitecrmApp = suitecrmApp({
    env: appEnv,
    appSecret: appSecret,
    siteFQDN: siteFQDN,
    image: getImageName("marketing-suitecrm-app"),
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
    resourceGroupName: resourceGroupName,
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
export const customDomains = nginxCerts(mauticNginxApp, deployedStrapiApp, marketing_env, cloudflareDNSentries);

// Deploy the Jumpbox container app
export const jumpboxApp = jumpbox({
    env: appEnv,
    managedEnvironmentId: marketing_env.id,
    storageName: jumpboxStorage.name,  // Updated to use jumpbox storage
    dbHost: dbHost,
    dbPort: dbPort,
    resourceGroupName: resourceGroupName,
});
    break;
  }
}


