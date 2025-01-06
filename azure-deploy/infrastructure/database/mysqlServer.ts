import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";

const config = new pulumi.Config();
const location = config.require("location");
const mysqlPassword = config.requireSecret("mysqlAdminPassword");

// Add configurable administrator login
const mysqlAdminUser = config.require("mysqlAdminUser"); 

// Add configurable server name
const mysqlServerName = config.require("mysqlServerName"); // Use config value

// Add configurable SKU name and tier
const mysqlSkuName = config.require("mysqlSkuName")
const mysqlSkuTier = config.require("mysqlSkuTier") as keyof typeof azure_native.dbformysql.SkuTier;

export const marketing_mysql = new azure_native.dbformysql.Server(mysqlServerName, {
    administratorLogin: mysqlAdminUser, 
    administratorLoginPassword: mysqlPassword,
    availabilityZone: "1",
    backup: {
        backupRetentionDays: 7,
        geoRedundantBackup: azure_native.dbformysql.EnableStatusEnum.Disabled,
    },
    highAvailability: {
        mode: azure_native.dbformysql.HighAvailabilityMode.Disabled,
        standbyAvailabilityZone: "",
    },
    location: location,
    maintenanceWindow: {
        customWindow: "Disabled",
        dayOfWeek: 0,
        startHour: 0,
        startMinute: 0,
    },
    replicationRole: azure_native.dbformysql.ReplicationRole.None,
    resourceGroupName: ResourceGroup.name,
    serverName: mysqlServerName, 
    sku: {
        name: mysqlSkuName, 
        tier: mysqlSkuTier, // Ensure tier is correctly set from config
    },
    storage: {
        autoGrow: azure_native.dbformysql.EnableStatusEnum.Enabled,
        autoIoScaling: azure_native.dbformysql.EnableStatusEnum.Disabled,
        iops: 396,
        logOnDisk: azure_native.dbformysql.EnableStatusEnum.Disabled,
        storageSizeGB: 32,
    },
    version: azure_native.dbformysql.ServerVersion.ServerVersion_8_0_21,
}, {
    protect: false,
});

// Allow the MysqlAdmin user to login from anywhere
export const mysqlFirewallRule = new azure_native.dbformysql.FirewallRule("AllowAllIps", {
    endIpAddress: "0.0.0.0",
    resourceGroupName: ResourceGroup.name,
    serverName: mysqlServerName,
    startIpAddress: "0.0.0.0",
}, { dependsOn: [marketing_mysql] });