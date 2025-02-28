import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";
import * as fs from "fs";
import * as path from "path";
import * as command from "@pulumi/command";

const config = new pulumi.Config();
const configStorageAccountName = config.require("storageAccountName"); 
const ipAddressOrRange = config.get("ipAddressOrRange");

export const storageAccount = new azure_native.storage.StorageAccount(configStorageAccountName, {
    accessTier: azure_native.storage.AccessTier.Hot,
    accountName: configStorageAccountName, 
    allowCrossTenantReplication: false,
    kind: azure_native.storage.Kind.StorageV2,
    
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

export const mauticAppFilesStorage = new azure_native.storage.FileShare("mautic-app-files", {
    accountName: storageAccount.name,
    resourceGroupName: ResourceGroup.name,
    shareName: "mautic-app-files",
});

export const strapiAppFilesStorage = new azure_native.storage.FileShare("strapi-app-files", {
    accountName: storageAccount.name,
    resourceGroupName: ResourceGroup.name,
    shareName: "strapi-app-files",
});

export const suiteCrmAppFilesStorage = new azure_native.storage.FileShare("suitecrm-app-files", {
    accountName: storageAccount.name,
    resourceGroupName: ResourceGroup.name,
    shareName: "suitecrm-app-files",
});

// Add the Jumpbox FileShare
export const jumpboxFilesStorage = new azure_native.storage.FileShare("jumpbox-files", {
    accountName: storageAccount.name,
    resourceGroupName: ResourceGroup.name,
    shareName: "jumpbox-files",
});

// Add creation of the base "config" directory for SuiteCRM
const createSuiteCrmBaseConfigDirectory = new command.local.Command("CreateSuiteCrmBaseConfigDirectory", {
    create: pulumi.interpolate`az storage directory create --account-name ${storageAccount.name} \
      --share-name ${suiteCrmAppFilesStorage.name} \
      --auth-mode key \
      --account-key ${storageAccountKey} \
      --name config`,
    triggers: [new Date().toISOString()],
}, {
    dependsOn: [suiteCrmAppFilesStorage],
});

// Create the "config/suitecrm" subdirectory
const createSuiteCrmConfigSubDirectory = new command.local.Command("CreateSuiteCrmConfigSubDirectory", {
    create: pulumi.interpolate`az storage directory create --account-name ${storageAccount.name} \
      --share-name ${suiteCrmAppFilesStorage.name} \
      --auth-mode key \
      --account-key ${storageAccountKey} \
      --name config/suitecrm`,
    triggers: [createSuiteCrmBaseConfigDirectory.stdout],
}, {
    dependsOn: [suiteCrmAppFilesStorage, createSuiteCrmBaseConfigDirectory],
});

const mauticConfigFileName = "local.php";
const mauticlocalPhpFilePath = path.join(__dirname, mauticConfigFileName);
fs.writeFileSync(mauticlocalPhpFilePath,"");

const configFileExists = new command.local.Command("Check for Config File Exists", {
    create: pulumi.interpolate`az storage file exists --account-name ${storageAccount.name} \
      --share-name ${mauticAppFilesStorage.name} \
      --auth-mode key \
      --account-key ${storageAccountKey} \
      --path config/${mauticConfigFileName}`,
      triggers: [new Date().toISOString()],
  },{
        dependsOn: [mauticAppFilesStorage]
  });


// Command to create the config directory
const createConfigDirectory = new command.local.Command("CreateConfigDirectory", {
    create: pulumi.interpolate`az storage directory create --account-name ${storageAccount.name} \
      --share-name ${mauticAppFilesStorage.name} \
      --auth-mode key \
      --account-key ${storageAccountKey} \
      --name config`,
    triggers: [configFileExists],
}, {
    
    dependsOn: [mauticAppFilesStorage],
});

export const configFilePlaceholder = new command.local.Command("uploadFile", {
    create: configFileExists.stdout.apply(out => 
        out.includes('"exists": false') ? pulumi.interpolate` \
            az storage file upload --account-name ${storageAccount.name} \
            --source ${mauticlocalPhpFilePath} \
            --share-name ${mauticAppFilesStorage.name} \
            --auth-mode key \
            --account-key ${storageAccountKey} \
            --path config/${mauticConfigFileName}` 
            : pulumi.interpolate`echo "File already exists. Skipping upload. File exists: ${out}"`,
    ),
    triggers: [createConfigDirectory.stdout],
}, {

    dependsOn: [mauticAppFilesStorage, createConfigDirectory, configFileExists],
});


// Define the file name and local path for SuiteCRM’s config_override file.
const suiteCrmOverrideFileName = "config_override.php";
const suiteCrmLocalOverrideFilePath = path.join(__dirname, suiteCrmOverrideFileName);

// Get domain and subdomain from config
const domain = config.require("domain");
const crmSubdomain = config.get("crmSubdomain") || "crm";
const suiteCrmSiteUrl = `${crmSubdomain}.${domain}`;

// Create config_override.php with dynamic content
const suiteCrmOverrideContent = `<?php
$sugar_config['http_referer']['list'][] = '${suiteCrmSiteUrl}';
`;
fs.writeFileSync(suiteCrmLocalOverrideFilePath, suiteCrmOverrideContent, {encoding: 'utf8'});

// Generate a hash for the override content too
const overrideContentHash = require("crypto").createHash("md5").update(suiteCrmOverrideContent).digest("hex");

// Check if the SuiteCRM config_override file already exists in the file share.
const suiteCrmOverrideFileExists = new command.local.Command("CheckForSuiteCrmOverrideFileExists", {
    create: pulumi.interpolate`az storage file exists --account-name ${storageAccount.name} \
      --share-name ${suiteCrmAppFilesStorage.name} \
      --auth-mode key \
      --account-key ${storageAccountKey} \
      --path config/suitecrm/${suiteCrmOverrideFileName}`,
    triggers: [createSuiteCrmConfigSubDirectory.stdout],
}, {
    dependsOn: [suiteCrmAppFilesStorage, createSuiteCrmConfigSubDirectory],
});

// Upload the config_override.php file ONLY if it doesn't exist
export const suiteCrmOverrideFilePlaceholder = new command.local.Command("UploadSuiteCrmOverrideFilePlaceholder", {
    create: suiteCrmOverrideFileExists.stdout.apply(out =>
        out.includes('"exists": false')
            ? pulumi.interpolate`az storage file upload --account-name ${storageAccount.name} \
                --source ${suiteCrmLocalOverrideFilePath} \
                --share-name ${suiteCrmAppFilesStorage.name} \
                --auth-mode key \
                --account-key ${storageAccountKey} \
                --path config/suitecrm/${suiteCrmOverrideFileName}`
            : pulumi.interpolate`echo "SuiteCRM override config file already exists. Skipping upload."`),
    triggers: [createSuiteCrmConfigSubDirectory.stdout, overrideContentHash], // Still track content hash for changes
}, {
    dependsOn: [suiteCrmAppFilesStorage, createSuiteCrmConfigSubDirectory, suiteCrmOverrideFileExists],
});

export const storageAccountName = storageAccount.name;

