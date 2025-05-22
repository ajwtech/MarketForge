import * as pulumi from "@pulumi/pulumi";
import { v20241001preview as azure_mysqldb } from "@pulumi/azure-native/dbformysql";
import * as azure_native from "@pulumi/azure-native";
import { mysqlSubnet } from "../networking/subnet";

const config = new pulumi.Config();
const resourceGroupName = config.require("resourceGroupName");
const location = config.require("location");
const mysqlPassword = config.requireSecret("mysqlAdminPassword");
const mysqlAdminUser = config.require("mysqlAdminUser"); 
const mysqlServerName = config.require("mysqlServerName");
const mysqlDbName = config.get("mysqlDbName") || "mautic";
const strapiDbName = config.get("strapiDbName") || "strapi";
const devStrapiDbName = config.get("devStrapiDbName") || "dev-strapi";
const suiteCrmDbName = config.get("suiteCrmDbName") || "suitecrm";
const mysqlSkuName = config.require("mysqlSkuName");
const mysqlSkuTier = config.require("mysqlSkuTier") as keyof typeof azure_mysqldb.ServerSkuTier;

export const marketing_mysql = new azure_mysqldb.Server(mysqlServerName, {
    administratorLogin: mysqlAdminUser, 
    administratorLoginPassword: mysqlPassword,
    availabilityZone: "",
    backup: {
        backupRetentionDays: 7,
        geoRedundantBackup: azure_mysqldb.EnableStatusEnum.Disabled,
    },
    highAvailability: {
        mode: azure_mysqldb.HighAvailabilityMode.Disabled,
        standbyAvailabilityZone: "",
    },
    location: location,
    maintenanceWindow: {
        customWindow: "Disabled",
        dayOfWeek: 0,
        startHour: 0,
        startMinute: 0,
    },
    replicationRole: azure_mysqldb.ReplicationRole.None,
    resourceGroupName: resourceGroupName,
    serverName: mysqlServerName, 
    sku: {
        name: mysqlSkuName, 
        tier: mysqlSkuTier, 
    },
    storage: {
        autoGrow: azure_mysqldb.EnableStatusEnum.Enabled,
        autoIoScaling: azure_mysqldb.EnableStatusEnum.Disabled,
        iops: 396,
        logOnDisk: azure_mysqldb.EnableStatusEnum.Disabled,
        storageSizeGB: 32,
    },
    version: azure_mysqldb.ServerVersion.ServerVersion_8_0_21,
    network: {
        delegatedSubnetResourceId: mysqlSubnet.id,
        publicNetworkAccess: "Disabled",
    },
}, {
    protect: false,
});

export const configurationRequire_secure_transport = new azure_native.dbformysql.Configuration("configuration",
    {
        resourceGroupName: resourceGroupName,
        configurationName: "require_secure_transport",
        serverName: mysqlServerName,
        source: "user-override",
        value: "OFF",
    }, { dependsOn: [marketing_mysql] });

export const configurationSqlMode = new azure_native.dbformysql.Configuration("sqlModeConfig", {
    resourceGroupName: resourceGroupName,
    serverName: mysqlServerName,
    configurationName: "sql_mode",
    source: "user-override",
    value: "NO_ENGINE_SUBSTITUTION"
}, { dependsOn: [marketing_mysql] }); 

export const marketing_database = new azure_native.dbformysql.Database(mysqlDbName, {
    charset: "utf8",
    collation: "utf8_unicode_ci",
    resourceGroupName: resourceGroupName,
    serverName: mysqlServerName,
}, { dependsOn: [marketing_mysql] });

export const strapi_database = new azure_native.dbformysql.Database(strapiDbName, {
    charset: "utf8",
    collation: "utf8_unicode_ci",
    resourceGroupName: resourceGroupName,
    serverName: mysqlServerName,
}, { dependsOn: [marketing_mysql] });

export const dev_strapi_database = new azure_native.dbformysql.Database(devStrapiDbName, {
    charset: "utf8",
    collation: "utf8_unicode_ci",
    resourceGroupName: resourceGroupName,
    serverName: mysqlServerName,
}, { dependsOn: [marketing_mysql] });

export const suitecrm_database = new azure_native.dbformysql.Database(suiteCrmDbName, {
    charset: "utf8",
    collation: "utf8mb3_unicode_520_ci",
    databaseName: suiteCrmDbName,
    resourceGroupName: resourceGroupName,
    serverName: mysqlServerName,
}, { dependsOn: [marketing_mysql] });