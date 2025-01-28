import * as pulumi from "@pulumi/pulumi";
import {v20241001preview as azure_mysqldb}  from "@pulumi/azure-native/dbformysql";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";
import { mysqlSubnet } from "../networking/subnet";

const config = new pulumi.Config();
const location = config.require("location");
const mysqlPassword = config.requireSecret("mysqlAdminPassword");

// Add configurable administrator login
const mysqlAdminUser = config.require("mysqlAdminUser"); 

// Add configurable server name
const mysqlServerName = config.require("mysqlServerName"); // Use config value
const mysqlDbName = config.require("mysqlDbName"); // Use config value

// Add configurable SKU name and tier
const mysqlSkuName = config.require("mysqlSkuName")
const mysqlSkuTier = config.require("mysqlSkuTier") as keyof typeof azure_mysqldb.ServerSkuTier;



export const marketing_mysql = new azure_mysqldb.Server(mysqlServerName, {
    administratorLogin: mysqlAdminUser, 
    administratorLoginPassword: mysqlPassword,
    availabilityZone: "1",
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
    resourceGroupName: ResourceGroup.name,
    serverName: mysqlServerName, 
    sku: {
        name: mysqlSkuName, 
        tier: mysqlSkuTier, // Ensure tier is correctly set from config
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
        // privateDnsZoneResourceId: privateDnsZone.id,
        publicNetworkAccess: "Disabled",
      },
    

}, {
    protect: false,
}
);
export const configuration = new azure_native.dbformysql.Configuration("configuration",
    {
        resourceGroupName: ResourceGroup.name,
        configurationName: "require_secure_transport",
        serverName: mysqlServerName,
        source: "user-override",
        value: "OFF",
    }, { dependsOn: [marketing_mysql] });


// Create a database in the server
export const marketing_database = new azure_native.dbformysql.Database(mysqlDbName, {
    charset: "utf8",
    collation: "utf8_unicode_ci",
    resourceGroupName: ResourceGroup.name,
    serverName: mysqlServerName,
}, { dependsOn: [marketing_mysql] });


