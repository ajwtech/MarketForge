import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import * as docker from "@pulumi/docker"; // Import the Docker module
import { ResourceGroup } from "../resourceGroup";

const config = new pulumi.Config();
const acrSkuName = (config.get("acrSkuName") as azure_native.containerregistry.SkuName) || azure_native.containerregistry.SkuName.Basic;

export const marketingcr = new azure_native.containerregistry.Registry("marketingcr", {
    adminUserEnabled: true,
    dataEndpointEnabled: false,
    encryption: {
        status: azure_native.containerregistry.EncryptionStatus.Disabled,
    },
    location: config.require("location"),
    networkRuleBypassOptions: azure_native.containerregistry.NetworkRuleBypassOptions.AzureServices,
    policies: {
        exportPolicy: {
            status: azure_native.containerregistry.ExportPolicyStatus.Enabled,
        },
        quarantinePolicy: {
            status: azure_native.containerregistry.PolicyStatus.Disabled,
        },
        retentionPolicy: {
            days: 7,
            status: azure_native.containerregistry.PolicyStatus.Disabled,
        },
        trustPolicy: {
            status: azure_native.containerregistry.PolicyStatus.Disabled,
            type: azure_native.containerregistry.TrustPolicyType.Notary,
        },
    },
    publicNetworkAccess: azure_native.containerregistry.PublicNetworkAccess.Enabled,
    registryName: "marketingcr",
    resourceGroupName: ResourceGroup.name,
    sku: {
        name: azure_native.containerregistry.SkuName[acrSkuName],
    },
    zoneRedundancy: azure_native.containerregistry.ZoneRedundancy.Disabled,
}, {
    protect: false,
});

// Ensure the ACR is created before building images
const acrCredentials = pulumi.all([marketingcr.name, ResourceGroup.name]).apply(
    ([registryName, resourceGroupName]) => 
        azure_native.containerregistry.listRegistryCredentials({
            registryName: registryName,
            resourceGroupName: resourceGroupName,
        })
);

export const acrUsername = acrCredentials.apply(creds => creds.username || "");
export const acrPassword = acrCredentials.apply(creds => (creds.passwords && creds.passwords[0].value) || "");
export const registryUrl = marketingcr.loginServer;

// Make imageTag configurable
const imageTag = config.get("imageTag") || "latest";

// Build and push placeholder images to ACR
const placeholderImages = ["marketing-mautic_web", "marketing-nginx", "marketing-mautic_init", "marketing-mautic_cron", "marketing-mautic_worker"];

// Ensure no imageBuilds are defined here to prevent duplication