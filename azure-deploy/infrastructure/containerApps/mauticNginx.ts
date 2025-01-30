// Import necessary modules and resources
import * as pulumi from "@pulumi/pulumi";

import { mauticAppFilesStorage, storageAccountKey, storageAccountName, storageAccount } from "../storage/storageAccount";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

import { imageBuilds } from "../dockerImages"; // Ensure correct import

const config = new pulumi.Config(); 
const mauticWebUrl = config.get("mauticWebUrl") || "mautic-web";
const mauticServerName = config.get("mauticServerName") || "mautic-nginx";


export function mauticNginx(args: {
    env: string;
    image: pulumi.Input<string>;
    registryUrl: pulumi.Input<string>;
    registryUsername: pulumi.Input<string>;
    registryPassword: pulumi.Input<string>;
    managedEnvironmentId: pulumi.Input<string>;
    storageName: pulumi.Input<string>;
    dbHost: pulumi.Input<string>;
    dbPort: pulumi.Input<string>;
    dbName: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>;
}) {

    return new azure_app.ContainerApp("mautic-nginx", {
        
        configuration: {
            
            activeRevisionsMode: azure_app.ActiveRevisionsMode.Single,
            ingress: {
                allowInsecure: true,
                clientCertificateMode: "Ignore",
                external: true,
                targetPort: 80,
                traffic: [{
                    latestRevision: true, 
                    weight: 100,
                }],
                transport: "Http", 
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
                env: [
                    {
                        name: "MAUTIC_WEB_URL",
                        value: mauticWebUrl,
                    },
                    {
                        name: "MAUTIC_SERVER_NAME",
                        value: mauticServerName,
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
                ],
                image: args.image, // Use the passed-in image parameter
                name: "mautic-nginx",
                resources: {
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: [
                    {
                        mountPath: "/var/log",   // Nginx writes logs here
                        volumeName: "log",
                        subPath: "log",            // Maps to /log/nginx in the file share
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

                ],
            }],
            revisionSuffix: "",
            scale: {
                maxReplicas: 3, 
                minReplicas: 1,
                rules: [{
                    name: "http-scaler", 
                    http: { 
                        metadata: {
                            concurrentRequests: "100", 
                        },
                    },
                }],
            },
            volumes: [
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
            ],
        },
        
    },{
        
        protect: false,
        dependsOn: [mauticAppFilesStorage, storageAccount, imageBuilds["marketing-nginx"]], // Reference centralized image build
    });
}