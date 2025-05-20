import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

// Debug: Print Pulumi config at stack start
pulumi.runtime.allConfig().then((cfg: Record<string, pulumi.ConfigValue>) => {
  console.log("[appsStack] Pulumi config at stack start:", cfg);
});

const { mauticWeb, mauticNginx } = require("./infrastructure/containerApps/mauticApps");
const { strapiApp } = require("./infrastructure/containerApps/strapiApp");
const { suitecrmApp } = require("./infrastructure/containerApps/suiteCrmApp");
const { setupDns } = require("./infrastructure/dns/customDomains");
const { nginxCerts } = require("./infrastructure/certificates/nginxCerts");
const { jumpBox: jumpbox } = require("./infrastructure/containerApps/jumpbox");

const config = new pulumi.Config();
const infra = new pulumi.StackReference(config.require("infraStack"));
const acr = new pulumi.StackReference(config.require("acrStack"));

const appEnv = config.get("appEnv") || "prod";
const dbHost = infra.getOutput("marketing_mysql").apply((mysql: any) => mysql.fullyQualifiedDomainName);
const dbPort = config.get("dbPort") || "3306";
const dbName = config.get("dbName") || "mauticdb";
const dbType = config.get("dbType") || "mysqli";
const dbVersion = config.get("dbVersion") || "8.0";
const dbCharset = config.get("dbCharset") || "utf8mb4";
const strapiDbName = config.get("strapiDbName") || "strapi";
const suitecrmDbName = config.get("suitecrmDbName") || "suitecrm";
const dbUser = config.get("dbUser") || config.get("mysqlAdminUser") || "mySqlAdmin";
const dbPassword = config.requireSecret("dbPassword");
const appSecret = config.get("appSecret") || "";
const domain = config.require("domain");
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const crmSubdomain = config.get("crmSubdomain") || "crm";
const mapSubdomain = config.get("mapSubdomain") || "map";
const BoolSubdomains = config.getBoolean("createSubdomains") || false;
const imageTag = config.get("imageTag") || "latest";
let createSubdomains: pulumi.Output<boolean> = pulumi.output(false).apply(unwrapped => unwrapped);
const storageAccountName = infra.getOutput("storageAccountName");
const resourceGroupName = infra.getOutput("ResourceGroup").apply((rg: any) => rg.name || rg);
const registryUrl = acr.getOutput("registryUrl");
const acrUsername = acr.getOutput("acrUsername");
const acrPassword = acr.getOutput("acrPassword");
const marketing_env = infra.getOutput("marketing_env");
const mauticAppFilesStorage = infra.getOutput("mauticAppFilesStorage");
const suiteCrmAppFilesStorage = infra.getOutput("suiteCrmAppFilesStorage");
const strapiAppFilesStorage = infra.getOutput("strapiAppFilesStorage");
const jumpboxFilesStorage = infra.getOutput("jumpboxFilesStorage");
const storageAccountKey = infra.getOutput("storageAccountKey");

function getImageName(registryUrl: pulumi.Output<string>, imageTag: string, imageName: string): pulumi.Output<string> {
    return registryUrl.apply(url => `${url}/${imageName}:${imageTag}`);
}

const mauticStorage = new azure_app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
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
}, { protect: false, dependsOn: [mauticAppFilesStorage] });

const strapiStorage = new azure_app.ManagedEnvironmentsStorage("strapi-app-files-storage", {
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
}, { protect: false, dependsOn: [strapiAppFilesStorage] });

const suitecrmStorage = new azure_app.ManagedEnvironmentsStorage("suitecrm-app-files-storage", {
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
}, { protect: false, dependsOn: [suiteCrmAppFilesStorage] });

const jumpboxStorage = new azure_app.ManagedEnvironmentsStorage("jumpbox-files-storage", {
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
}, { protect: false, dependsOn: [jumpboxFilesStorage] });

const mauticNginxApp = mauticNginx({
    env: appEnv,
    image: getImageName(registryUrl, imageTag, "marketing-nginx"),
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: mauticStorage.name,
    suiteCrmStorageName: suitecrmStorage.name,
    dbHost,
    dbPort,
    dbName,
    resourceGroupName,
    createSubdomains,
});
const siteFQDN = mauticNginxApp.configuration.apply((fqdn: any) => fqdn?.ingress?.fqdn ?? "localhost");
const nginxCvid = mauticNginxApp.customDomainVerificationId.apply((cvid: any) => cvid);

const mauticWebApp = mauticWeb({
    env: appEnv,
    image: getImageName(registryUrl, imageTag, "marketing-mautic-app"),
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: mauticStorage.name,
    dbHost,
    dbPort,
    dbName,
    dbUser,
    dbPassword,
    appSecret,
    resourceGroupName,
    siteFQDN,
    siteUrl: pulumi.interpolate`https://${mapSubdomain}.${domain}/`,
});

const deployedStrapiApp = strapiApp({
    env: appEnv,
    image: getImageName(registryUrl, imageTag, "marketing-strapi-app"),
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: strapiStorage.name,
    dbHost,
    dbPort,
    dbName: strapiDbName,
    dbUser,
    dbPassword,
    dbClient: pulumi.output("postgres"),
    jwtSecret: pulumi.output("jwtSecret"),
    adminJwtSecret: pulumi.output("adminJwtSecret"),
    appKeys: pulumi.output("appKeys"),
    nodeEnv: pulumi.output("production"),
    resourceGroupName,
    apiToken: pulumi.output("apiToken"),
    transferTokenSalt: pulumi.output("transferTokenSalt"),
    cmsUrl: pulumi.interpolate`https://${cmsSubdomain}.${domain}/`,
});

const deployedSuitecrmApp = suitecrmApp({
    env: appEnv,
    appSecret,
    siteFQDN,
    image: getImageName(registryUrl, imageTag, "marketing-suitecrm-app"),
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: marketing_env.id,
    storageName: suitecrmStorage.name,
    dbHost,
    dbPort,
    dbName: suitecrmDbName,
    dbUser,
    dbPassword,
    dbType,
    dbVersion,
    dbCharset,
    resourceGroupName,
    siteUrl: pulumi.interpolate`https://${crmSubdomain}.${domain}/`,
    crmSubdomain,
    domain,
});

const cloudflareDNSentries = BoolSubdomains ? setupDns({
    domain,
    cmsSubdomain,
    crmSubdomain,
    mapSubdomain,
    siteFQDN,
    nginxCvid,
    mauticNginxApp,
    strapiApp: deployedStrapiApp,
    strapiFQDN: deployedStrapiApp.configuration.apply((fqdn: any) => fqdn?.ingress?.fqdn ?? "localhost"),
    suiteCrmApp: deployedSuitecrmApp,
    suiteCrmFQDN: deployedSuitecrmApp.configuration.apply((fqdn: any) => fqdn?.ingress?.fqdn ?? "localhost"),
}) : undefined;

const customDomains = nginxCerts(mauticNginxApp, deployedStrapiApp, marketing_env, cloudflareDNSentries);

const jumpboxApp = jumpbox({
    env: appEnv,
    managedEnvironmentId: marketing_env.id,
    storageName: jumpboxStorage.name,
    dbHost,
    dbPort,
    resourceGroupName,
});

export {
    mauticNginxApp,
    mauticWebApp,
    deployedStrapiApp,
    deployedSuitecrmApp,
    cloudflareDNSentries,
    customDomains,
    jumpboxApp
};
