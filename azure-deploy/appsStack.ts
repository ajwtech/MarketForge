import * as pulumi from "@pulumi/pulumi";
import { mauticNginx, mauticWeb } from "./infrastructure/containerApps/mauticApps";
import { strapiApp } from "./infrastructure/containerApps/strapiApp";
import { suitecrmApp } from "./infrastructure/containerApps/suiteCrmApp";
import * as dns from "./infrastructure/dns/customDomains";
import { jumpBox as jumpbox} from "./infrastructure/containerApps/jumpbox";
import { acr, infra } from "./stackRefs";

const config = new pulumi.Config();

const appEnv = config.get("appEnv") || "prod";

// Generate secure random tokens for Strapi
const jwtSecret = config.getSecret("jwtSecret") || config.require("jwtSecret");
const adminJwtSecret = config.getSecret("adminJwtSecret") || config.require("adminJwtSecret"); 
const appKeys = config.getSecret("appKeys") || config.require("appKeys");
const apiTokenSalt = config.getSecret("apiTokenSalt") || config.require("apiTokenSalt");
const transferTokenSalt = config.getSecret("transferTokenSalt") || config.require("transferTokenSalt");

const dbHost = infra.getOutput("marketing_mysql_fqdn");
const dbPort = config.get("dbPort") || "3306";
const dbName = config.get("dbName") || "mauticdb";
const dbType = config.get("dbType") || "mysql"; // mysql is the correct client name for Strapi MySQL connections
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
const betaSubdomain = config.get("betaSubdomain") || "beta";
const imageTag = config.get("imageTag") || "latest";
let createSubdomains: pulumi.Output<boolean> = pulumi.output(false).apply(unwrapped => unwrapped);
const storageAccountName = infra.getOutput("storageAccountName");
const resourceGroupName = acr.getOutput("resourceGroupName");
const registryUrl = acr.getOutput("registryUrlOut");
const acrUsername = acr.getOutput("acrUsernameOut");
const acrPassword = acr.getOutput("acrPasswordOut");
const marketing_env = infra.getOutput("marketing_env_name");
const managedEnvironmentId  = infra.getOutput("marketing_env_id");
const mauticStorageName = infra.getOutput("mauticStorage_name");
const strapiStorageName = infra.getOutput("strapiStorage_name");
const suitecrmStorageName = infra.getOutput("suitecrmStorage_name");
const jumpboxStorageName = infra.getOutput("jumpboxStorage_name");
const storageAccountKey = infra.getOutput("storageAccountKey");


registryUrl.apply(url => pulumi.log.info(`registryUrl resolved value: ${url}`));

// 1. Import mauticNginx and create the app
const mauticNginxApp = mauticNginx({
    env: appEnv,
    image: pulumi.interpolate`${registryUrl}/marketing-nginx:${imageTag}`,
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

// 2. Get the custom domain verification ID
const nginxCvid = mauticNginxApp.customDomainVerificationId.apply(id => String(id));
const siteFQDN = mauticNginxApp.configuration.apply(fqdn => fqdn?.ingress?.fqdn ?? "localhost");

// 3. Create the DNS records using setupDns
const asuidRecords = dns.setupAsuidDnsRecords({
    domain,
    cmsSubdomain,
    crmSubdomain,
    mapSubdomain,
    betaSubdomain,
    siteFQDN,
    nginxCvid
});


// 4. Import and create the other apps, with explicit dependencies on DNS records
const deployedStrapiApp = strapiApp({
    env: appEnv,
    image: pulumi.interpolate`${registryUrl}/marketing-strapi-app:${imageTag}`,
    registryUrl,
    registryUsername: acrUsername,
    registryPassword: acrPassword,
    managedEnvironmentId: managedEnvironmentId,
    storageName: strapiStorageName,
    storageAccountName,
    storageAccountKey,
    dbHost,
    dbPort,
    dbName: strapiDbName,
    dbUser,
    dbPassword,
    dbClient: dbType,
    jwtSecret: jwtSecret,
    adminJwtSecret: adminJwtSecret,
    appKeys: appKeys,
    nodeEnv: pulumi.output("production"),
    resourceGroupName,
    apiToken: apiTokenSalt,
    transferTokenSalt: transferTokenSalt,
    cmsUrl: pulumi.interpolate`https://${cmsSubdomain}.${domain}/`,
});

const deployedSuitecrmApp = suitecrmApp({
    env: appEnv,
    appSecret,
    siteFQDN,
    image: pulumi.interpolate`${registryUrl}/marketing-suitecrm-app:${imageTag}`,
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

const mauticWebApp = mauticWeb({
    env: appEnv,
    image: pulumi.interpolate`${registryUrl}/marketing-mautic-app:${imageTag}`,
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
    siteFQDN: siteFQDN,
    siteUrl: pulumi.interpolate`https://${mapSubdomain}.${domain}/`,
    storageAccountName,
    storageAccountKey,
    configFilePlaceholder: infra.getOutput("configFilePlaceholder"), // optional, if needed
});

const jumpboxApp = jumpbox({
    env: appEnv,
    managedEnvironmentId: managedEnvironmentId,
    storageName: jumpboxStorageName,
    storageAccountName,
    storageAccountKey,
    dbHost,
    dbPort,
    resourceGroupName,
});

const CnameDnsRecords = dns.setupCnameDnsRecords({
    domain,
    cmsSubdomain,
    crmSubdomain,
    mapSubdomain,
    betaSubdomain,
    siteFQDN,
    suiteCrmFQDN: deployedSuitecrmApp.configuration.apply(cfg => cfg?.ingress?.fqdn ?? "localhost"),
    strapiFQDN: deployedStrapiApp.configuration.apply(cfg => cfg?.ingress?.fqdn ?? "localhost"),
    mauticNginxFQDN: mauticNginxApp.configuration.apply(cfg => cfg?.ingress?.fqdn ?? "localhost"),
});




export function returnOutputs() {
    return {
        mauticNginxApp,
        deployedStrapiApp,
        marketing_env,
        asuidCmsRecords: asuidRecords.cmsTXT,
        asuidCrmRecords: asuidRecords.crmTXT,
        asuidMapRecords: asuidRecords.mapTXT,
        asuidBetaRecords: asuidRecords.betaTXT,
        cnameCmsEntries: CnameDnsRecords.cmsCNAME,
        cnameCrmEntries: CnameDnsRecords.crmCNAME,
        cnameMapEntries: CnameDnsRecords.mapCNAME,
        cnameBetaEntries: CnameDnsRecords.betaCNAME,
    };
}
