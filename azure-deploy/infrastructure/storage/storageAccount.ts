import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";

const config = new pulumi.Config();
const configStorageAccountName = config.require("storageAccountName"); 
const location = config.require("location");
const ipAddressOrRange = config.get("ipAddressOrRange");
const resourceGroupName = config.require("resourceGroupName");

export const storageAccount = new azure_native.storage.StorageAccount("marketingstackstorage", {
    accessTier: azure_native.storage.AccessTier.Hot,
    accountName: configStorageAccountName, 
    allowBlobPublicAccess: true, // Allow public access for static web content
    allowCrossTenantReplication: false,
    allowSharedKeyAccess: true,
    defaultToOAuthAuthentication: false,
    dnsEndpointType: azure_native.storage.DnsEndpointType.Standard,
    enableHttpsTrafficOnly: true, // Enable HTTPS traffic only for security
    kind: azure_native.storage.Kind.StorageV2,
    largeFileSharesState: azure_native.storage.LargeFileSharesState.Disabled, // Disable large file shares
    location: location,
    minimumTlsVersion: azure_native.storage.MinimumTlsVersion.TLS1_2,
    networkRuleSet: ipAddressOrRange ? {
        bypass: azure_native.storage.Bypass.AzureServices,
        defaultAction: azure_native.storage.DefaultAction.Deny,
        ipRules: [{
            action: azure_native.storage.Action.Allow,
            iPAddressOrRange: ipAddressOrRange,
        }],
    } : {
        bypass: azure_native.storage.Bypass.AzureServices,
        defaultAction: azure_native.storage.DefaultAction.Allow,
        ipRules: [],
    },
    publicNetworkAccess: azure_native.storage.PublicNetworkAccess.Enabled,
    resourceGroupName: ResourceGroup.name,
    routingPreference: {
        publishInternetEndpoints: true, // Publish internet endpoints for static web content
        publishMicrosoftEndpoints: true,
        routingChoice: azure_native.storage.RoutingChoice.MicrosoftRouting,
    },
    sku: {
        name: azure_native.storage.SkuName.Standard_LRS,
    },
}, {
    ignoreChanges: ["networkRuleSet"],
    protect: false,
});

// Export the storage account key
export const storageAccountKey = pulumi.all([storageAccount.name, ResourceGroup.name]).apply(([name, rgName]) =>
    azure_native.storage.listStorageAccountKeys({
        accountName: name,
        resourceGroupName: rgName,
    }).then(keys => keys.keys[0].value)
);

// Define the File Share for static web content
export const mauticAppFilesStorage = new azure_native.storage.FileShare("mautic-app-files", {
    accountName: storageAccount.name,
    resourceGroupName: ResourceGroup.name,
    
});

export const mauticStaticHosting = new azure_native.storage.StorageAccountStaticWebsite("mauticstatichosting", {
    accountName: storageAccount.name,
    resourceGroupName:  ResourceGroup.name,
   // error404Document: "string",
   //indexDocument: "string",
});

export const storageAccountName = storageAccount.name;

