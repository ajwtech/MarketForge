// Import necessary modules and resources
import * as pulumi from "@pulumi/pulumi";

import { mauticAppFilesStorage, storageAccountKey, storageAccountName, storageAccount } from "../storage/storageAccount";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

import { imageBuilds } from "../dockerImages"; // Ensure correct import

const config = new pulumi.Config(); 
const nginxServerName = config.get("nginxServerName") || "mautic-nginx";
const mauticWebUrl = config.get("mauticWebUrl") || "mautic-web";
const strapiAppUrl = config.get("strapiAppUrl") || "strapi-app";
const suiteCrmAppUrl = config.get("suiteCrmAppUrl") || "suitecrm-app";
const domain = config.require("domain");
const crmSubdomain = config.get("crmSubdomain") || "crm";
const mapSubdomain = config.get("mapSubdomain") || "map";

export function mauticNginx(args: {
    env: string;
    image: pulumi.Input<string>;
    registryUrl: pulumi.Input<string>;
    registryUsername: pulumi.Input<string>;
    registryPassword: pulumi.Input<string>;
    managedEnvironmentId: pulumi.Input<string>;
    storageName: pulumi.Input<string>;
    suiteCrmStorageName: pulumi.Input<string>;
    frontendStorageName?: pulumi.Input<string>; // Add frontend storage name (optional)
    dbHost: pulumi.Input<string>;
    dbPort: pulumi.Input<string>;
    dbName: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>;
    createSubdomains: pulumi.Input<boolean>;
    azureFunctionUrl?: pulumi.Input<string>; // Add Azure Function URL (optional)
}) {
   
    const imageDigest = imageBuilds["marketing-nginx"].digest; // Ensure correct image reference

    // Get environment variables including the new Azure Function URL
    const envVars = [
        {
            name: "MAUTIC_WEB_URL",
            value: mauticWebUrl,
        },
        {
            name: "STRAPI_APP_URL", 
            value: strapiAppUrl,
        },
        {
            name: "SUITECRM_APP_URL", 
            value: suiteCrmAppUrl,
        },
        // {
        //     name: "FRONTEND_APP_URL",
        //     value: args.azureFunctionUrl,
        // },
        {
            name: "MAUTIC_SERVER_NAME",
            value: nginxServerName,
        },
        {
            name: "STORAGE_ACCOUNT_NAME",
            value: storageAccountName,
        },
        {
            name: "STORAGE_ACCOUNT_KEY",
            value: storageAccountKey,
        },
        {
            name: "DB_HOST",
            value: args.dbHost, 
        },
        {
            name: "DB_PORT",
            value: args.dbPort, 
        },
        {
            name: "DB_NAME",
            value: args.dbName, 
        },
        {
            name: "DEPLOY_TRIGGER",
            value: imageDigest,
        }
    ];

    // Prepare volume mounts
    const volumeMounts = [
        {
            mountPath: "/var/log",   // Nginx writes logs here
            volumeName: "log",
            subPath: "log/nginx",            // Maps to /log/nginx in the file share
        },
        {
            mountPath: "/var/www/html/docroot/media/files",  // Path where Nginx expects media files
            volumeName: "files",
            subPath: "media/files",   // Maps to /media in the Azure File Share root
        },
        {
            mountPath: "/var/www/html/docroot/media/images",  // Path where Nginx expects media files
            volumeName: "images",
            subPath: "media/images",   // Maps to /media in the Azure File Share root
        },
        {
            mountPath: "/var/suitecrm/www/html/public/legacy/cache",
            volumeName: "suitecrm-app-cache",
            subPath: "cache",
        }
    ];

    // Add frontend mount if storage is provided
    if (args.frontendStorageName) {
        volumeMounts.push({
            mountPath: "/var/www/marketingSite",
            volumeName: "frontend-files",
            subPath: "marketingSite",
        });
    }

    // Prepare volumes
    const volumes = [
        {
            name: "log",
            storageName: args.storageName,
            storageType: azure_app.StorageType.AzureFile,
        },
        {
            name: "files",
            storageName: args.storageName,
            storageType: azure_app.StorageType.AzureFile,
        }, 
        {
            name: "images",
            storageName: args.storageName,
            storageType: azure_app.StorageType.AzureFile,
        },
        {
            name: "suitecrm-app-cache",
            storageName: args.suiteCrmStorageName,
            storageType: azure_app.StorageType.AzureFile
        }
    ];

    // Add frontend volume if storage is provided
    if (args.frontendStorageName) {
        volumes.push({
            name: "frontend-files",
            storageName: args.frontendStorageName,
            storageType: azure_app.StorageType.AzureFile
        });
    }

    return new azure_app.ContainerApp("mautic-nginx", {

        configuration: {
            activeRevisionsMode: azure_app.ActiveRevisionsMode.Single,
            ingress: {
                allowInsecure: false,
                clientCertificateMode: "Ignore",
                external: true,
                targetPort: 80,
                traffic: [{
                    latestRevision: true, 
                    weight: 100,
                }],
                transport: "Auto",
                customDomains: [
                    { bindingType: 'Disabled', name: `${crmSubdomain}.${domain}` },
                    { bindingType: 'Disabled', name: `${mapSubdomain}.${domain}` }
                ] ,
            },
            maxInactiveRevisions: 100,
            registries: [{
                identity: "",
                passwordSecretRef: "registry-password",
                server: args.registryUrl,
                username: args.registryUsername,
            }],
            secrets: [{
                name: "acr-password",
                value: args.registryPassword,
            },
            {
                name: "registry-password",
                value: args.registryPassword, 
            }],
        },
        containerAppName: "mautic-nginx",
        environmentId: args.managedEnvironmentId,
        identity: {
            type: azure_app.ManagedServiceIdentityType.None,
        },
        location: config.require("location"),
        managedEnvironmentId: args.managedEnvironmentId,
        resourceGroupName: args.resourceGroupName, 
        template: {
            containers: [{
                env: envVars,
                image: args.image, // Use the passed-in image parameter
                name: "mautic-nginx",
                resources: {
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: volumeMounts,
            }],
            scale: {
                maxReplicas: 3, 
                minReplicas: 0,
                rules: [{
                    name: "http-scaler", 
                    http: { 
                        metadata: {
                            concurrentRequests: "100", 
                        },
                    },
                }],
            },
            volumes: volumes,
        },
        
    },{
        replaceOnChanges: ["image", "createSubdomains" ],
        protect: false,
        dependsOn: [ mauticAppFilesStorage, storageAccount, imageBuilds["marketing-nginx"]], // Reference centralized image build
    });
}