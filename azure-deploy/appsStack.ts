import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { mauticWeb, mauticNginx } from "./infrastructure/containerApps/mauticApps";
import { strapiApp } from "./infrastructure/containerApps/strapiApp";
import { suitecrmApp } from "./infrastructure/containerApps/suiteCrmApp";
import { setupDns } from "./infrastructure/dns/customDomains";
import { nginxCerts } from "./infrastructure/certificates/nginxCerts";
import { jumpBox as jumpbox} from "./infrastructure/containerApps/jumpbox";
import { acr, infra } from "./stackRefs";


const config = new pulumi.Config();

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
const resourceGroupName = acr.getOutput("resourceGroup").apply((rg: any) => rg.name || rg);
const registryUrl = acr.getOutput("registryUrl");
const acrUsername = acr.getOutput("acrUsername");
const acrPassword = acr.getOutput("acrPassword");
const marketing_env = infra.getOutput("marketing_env");
const mauticAppFilesStorage = infra.getOutput("mauticAppFilesStorage");
const suiteCrmAppFilesStorage = infra.getOutput("suiteCrmAppFilesStorage");
const strapiAppFilesStorage = infra.getOutput("strapiAppFilesStorage");
const jumpboxFilesStorage = infra.getOutput("jumpboxFilesStorage");
const storageAccountKey = infra.getOutput("storageAccountKey");

// Debug: Log StackReference outputs before using them
acr.getOutput("resourceGroup").apply(rg => { console.log("acr.resourceGroup output:", rg); return rg; });
acr.getOutput("registryUrl").apply(url => { console.log("acr.registryUrl output:", url); return url; });
acr.getOutput("acrUsername").apply(u => { console.log("acr.acrUsername output:", u); return u; });
acr.getOutput("acrPassword").apply(p => { console.log("acr.acrPassword output:", p); return p; });
infra.getOutput("marketing_env").apply(env => { console.log("infra.marketing_env output:", env); return env; });
infra.getOutput("mauticStorage").apply(s => { console.log("infra.mauticStorage output:", s); return s; });
infra.getOutput("strapiStorage").apply(s => { console.log("infra.strapiStorage output:", s); return s; });
infra.getOutput("suitecrmStorage").apply(s => { console.log("infra.suitecrmStorage output:", s); return s; });
infra.getOutput("jumpboxStorage").apply(s => { console.log("infra.jumpboxStorage output:", s); return s; });

// Ensure registryUrl is Output<string>
const registryUrlString: pulumi.Output<string> = registryUrl.apply(url => String(url));

// Helper to get .id from Output<any>
const getId = (output: pulumi.Output<any>) => output.apply((x: any) => x.id);
const getName = (output: pulumi.Output<any>) => output.apply((x: any) => x.name);

function getImageName(registryUrl: pulumi.Output<string>, imageTag: string, imageName: string): pulumi.Output<string> {
    return registryUrl.apply(url => `${url}/${imageName}:${imageTag}`);
}

const managedEnvironmentId = marketing_env.apply(env => env.id);

// Remove direct import of storage resources from infraStack
// import { mauticStorage, strapiStorage, suitecrmStorage, jumpboxStorage } from "./infraStack";

// Use StackReference outputs for storage resources
const mauticStorageName = infra.getOutput("mauticStorage").apply(s => s.name);
const strapiStorageName = infra.getOutput("strapiStorage").apply(s => s.name);
const suitecrmStorageName = infra.getOutput("suitecrmStorage").apply(s => s.name);
const jumpboxStorageName = infra.getOutput("jumpboxStorage").apply(s => s.name);

const mauticNginxApp = mauticNginx({
    env: appEnv,
    image: getImageName(registryUrlString, imageTag, "marketing-nginx"),
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: managedEnvironmentId,
    storageName: mauticStorageName,
    suiteCrmStorageName: suitecrmStorageName,
    dbHost,
    dbPort,
    dbName,
    resourceGroupName,
    createSubdomains,
    storageAccountName, 
    storageAccountKey, 
});
const siteFQDN = mauticNginxApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost");
const nginxCvid = mauticNginxApp.customDomainVerificationId.apply(cvid => cvid);

const mauticWebApp = mauticWeb({
    env: appEnv,
    image: getImageName(registryUrlString, imageTag, "marketing-mautic-app"),
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: managedEnvironmentId,
    storageName: mauticStorageName,
    dbHost,
    dbPort,
    dbName,
    dbUser,
    dbPassword,
    appSecret,
    resourceGroupName,
    siteFQDN,
    siteUrl: pulumi.interpolate`https://${mapSubdomain}.${domain}/`,
    storageAccountName, // added for cross-stack reference
    storageAccountKey,  // added for cross-stack reference
    configFilePlaceholder: infra.getOutput("configFilePlaceholder"), // optional, if needed
});

const deployedStrapiApp = strapiApp({
    env: appEnv,
    image: getImageName(registryUrlString, imageTag, "marketing-strapi-app"),
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: managedEnvironmentId,
    storageName: strapiStorageName,
    dbHost,
    dbPort,
    dbName: strapiDbName,
    dbUser,
    dbPassword,
    dbClient: dbType,
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
    image: getImageName(registryUrlString, imageTag, "marketing-suitecrm-app"),
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: managedEnvironmentId,
    storageName: suitecrmStorageName,
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
    siteFQDN: siteFQDN.apply(fqdn => String(fqdn)),
    nginxCvid: nginxCvid.apply(id => String(id)),
    mauticNginxApp, // If setupDns expects the resource, this is correct
    strapiApp: deployedStrapiApp, // If setupDns expects the resource, this is correct
    strapiFQDN: deployedStrapiApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost"),
    suiteCrmApp: deployedSuitecrmApp, // If setupDns expects the resource, this is correct
    suiteCrmFQDN: deployedSuitecrmApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost"),
}) : undefined;

const customDomains = nginxCerts(
    mauticNginxApp,
    deployedStrapiApp,
    marketing_env.apply(env => env.name), // Pass environment name as Output<string>
    cloudflareDNSentries
);

const jumpboxApp = jumpbox({
    env: appEnv,
    managedEnvironmentId: marketing_env.apply(env => env.id),
    storageName: jumpboxStorageName,
    storageAccountName, // <-- add this
    storageAccountKey,  // <-- add this
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
    jumpboxApp,
};
