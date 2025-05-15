import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";
import * as fs from "fs";
import * as path from "path";
import * as command from "@pulumi/command";

const config = new pulumi.Config();
const configStorageAccountName = config.require("storageAccountName"); 
const ipAddressOrRange = config.get("ipAddressOrRange");
const domain = config.require("domain");
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const crmSubdomain = config.get("crmSubdomain") || "crm";
const allowedOrigins = [`https://${cmsSubdomain}.${domain}`];
const suiteCrmSiteUrl = `${crmSubdomain}.${domain}`;

export const storageAccount = new azure_native.storage.StorageAccount(configStorageAccountName, {
    accessTier: azure_native.storage.AccessTier.Hot,
    accountName: configStorageAccountName, 
    allowCrossTenantReplication: false,
    kind: azure_native.storage.Kind.StorageV2,
    allowBlobPublicAccess: true, 
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

export const blobServiceProperties = new azure_native.storage.BlobServiceProperties("blob-service-properties", {
    accountName: storageAccount.name,
    resourceGroupName: ResourceGroup.name,  
    blobServicesName: "default",
    cors: {
        corsRules: [
            {
                allowedOrigins: allowedOrigins,
                allowedMethods: ["GET", "HEAD", "OPTIONS"],
                allowedHeaders: ["*"],
                exposedHeaders: ["Content-Length", "Content-Type", "Content-Disposition", "Content-MD5"],
                maxAgeInSeconds: 3600
            }
        ]
    },
}, 
{
    dependsOn: [storageAccount],
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

// Add a new file share for frontend static files
export const frontendFilesStorage = new azure_native.storage.FileShare("frontend-files", {
    accountName: storageAccount.name,
    resourceGroupName: ResourceGroup.name,
    shareName: "frontend-files",
});

export const strapiPublicAssetsContainer = new azure_native.storage.BlobContainer("assets", {
    accountName: storageAccount.name,
    containerName: "assets",
    resourceGroupName: ResourceGroup.name,
    publicAccess: azure_native.storage.PublicAccess.Container, // Make it publicly accessible
});

export const strapiPrivateAssetsContainer = new azure_native.storage.BlobContainer("private-assets", {
    accountName: storageAccount.name,
    containerName: "private-assets",
    resourceGroupName: ResourceGroup.name,
    publicAccess: azure_native.storage.PublicAccess.None, // Keep it private
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

// Resolve the path to the Strapi directory
const strapiDirectoryPath = path.resolve(__dirname, "../../../launchpad/strapi");

// Helper function to hash all files in a directory recursively, excluding certain folders
function hashDirectory(dir: string, excludeDirs: string[] = []): string {
    const crypto = require("crypto");
    const fs = require("fs");
    const path = require("path");
    let hash = crypto.createHash("md5");
    function walk(currentPath: string) {
        const files = fs.readdirSync(currentPath);
        files.forEach((file: string) => {
            const filePath = path.join(currentPath, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                if (!excludeDirs.includes(file)) {
                    walk(filePath);
                }
            } else {
                hash.update(fs.readFileSync(filePath));
                hash.update(filePath); // include file path in hash
            }
        });
    }
    walk(dir);
    return hash.digest("hex");
}
const excludeDirsAndFiles = [".strapi", ".tmp", "dist", "node_modules", ".git"];
const stagingDir = path.join(strapiDirectoryPath, "../strapi-staging");

// Step 1: Stage files using rsync
const stageStrapiFiles = new command.local.Command("StageStrapiFiles", {
    create: `rsync -av --delete --include='*/' ${excludeDirsAndFiles.map(dir => `--exclude='${dir}'`).join(" ")} ${strapiDirectoryPath}/ ${stagingDir}/`,
}, {});

// Cross-platform wait command for staging directory
const isWin = process.platform === "win32";
const waitCmd = isWin
  ? `powershell -Command \"while (!(Test-Path '${stagingDir}')) { Start-Sleep -Seconds 1 }\"`
  : `while [ ! -d \"${stagingDir}\" ]; do sleep 1; done`;

const waitForStagingDir = new command.local.Command("WaitForStagingDir", {
    create: waitCmd,
    triggers: [stagingDir],
}, { dependsOn: [stageStrapiFiles] });

// Step 2: Hash the staging directory (after it exists)
const hashStagingDir = new command.local.Command("HashStagingDir", {
    create: pulumi.interpolate`node -e "const crypto = require('crypto'); const fs = require('fs'); const path = require('path'); function walk(d, e = []) { let h = crypto.createHash('md5'); fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!['.strapi','.tmp','dist','node_modules','.git'].includes(f)) h.update(walk(p)); } else { h.update(fs.readFileSync(p)); h.update(p); } }); return h.digest('hex'); } process.stdout.write(walk('${stagingDir}'));"`,
    triggers: [stagingDir],
}, { dependsOn: [waitForStagingDir] });

// Helper to get all files in a directory recursively (relative to root)
function getAllFiles(dir: string, root: string, excludeDirsAndFiles: string[]): string[] {
    const fs = require("fs");
    const path = require("path");
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    fs.readdirSync(dir).forEach((file: string) => {
        const filePath = path.join(dir, file);
        const relPath = path.relative(root, filePath);
        if (fs.statSync(filePath).isDirectory()) {
            if (!excludeDirsAndFiles.includes(file)) {
                results = results.concat(getAllFiles(filePath, root, excludeDirsAndFiles));
            }
        } else {
            results.push(relPath.replace(/\\/g, "/")); // Normalize for az CLI
        }
    });
    return results;
}

// Batch files for upload (OS safe, e.g. 500 per batch)
function chunkArray<T>(arr: T[], size: number): T[][] {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        res.push(arr.slice(i, i + size));
    }
    return res;
}

// Command to list all files after staging dir is ready, using the compiled JS script for readability
export const listStrapiFiles = new command.local.Command("ListStrapiFiles", {
    create: pulumi.interpolate`node ${path.resolve(__dirname, '../../scripts/listFiles.js')} ${stagingDir}`,
    triggers: [hashStagingDir.stdout],
}, { dependsOn: [hashStagingDir] });

// Upload strapi files in batches after file list is available
export const strapiFiles = listStrapiFiles.stdout.apply(stdout => {
    const files = JSON.parse(stdout || '[]');
    const BATCH_SIZE = 500;
    const batches = chunkArray(files, BATCH_SIZE);
    return batches.map((batch, i) =>
        new command.local.Command(`UploadStrapiFilesBatch${i+1}`, {
            create: pulumi.interpolate`for file in ${batch.map(f => `'${f}'`).join(' ')}; do az storage file upload \
                --account-name ${storageAccount.name} \
                --source ${stagingDir}/$file \
                --path "app/$file" \
                --share-name ${strapiAppFilesStorage.name} \
                --account-key ${storageAccountKey} \
                --max-connections 10; done`,
            triggers: [listStrapiFiles.stdout],
        }, {
            dependsOn: [strapiAppFilesStorage, listStrapiFiles],
        })
    );
});

export const storageAccountName = storageAccount.name;

