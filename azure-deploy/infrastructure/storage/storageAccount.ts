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

const configFileName = "local.php";
const localPhpFilePath = path.join(__dirname, configFileName);
fs.writeFileSync(localPhpFilePath,"");

 


const configFileExists = new command.local.Command("Check for Config File Exists", {
    create: pulumi.interpolate`az storage file exists --account-name ${storageAccount.name} \
      --share-name ${mauticAppFilesStorage.name} \
      --auth-mode key \
      --account-key ${storageAccountKey} \
      --path config/${configFileName}`,
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
            --source ${localPhpFilePath} \
            --share-name ${mauticAppFilesStorage.name} \
            --auth-mode key \
            --account-key ${storageAccountKey} \
            --path config/${configFileName}` 
            : pulumi.interpolate`echo "File already exists. Skipping upload. File exists: ${out}"`,
    ),
    triggers: [createConfigDirectory.stdout],
}, {

    dependsOn: [mauticAppFilesStorage, createConfigDirectory, configFileExists],
});

export const storageAccountName = storageAccount.name;

