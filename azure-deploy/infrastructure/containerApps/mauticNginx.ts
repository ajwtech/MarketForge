// Import necessary modules and resources
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { marketingcr } from "../registries/acrRegistry";
import { mauticAppFilesStorage, storageAccountKey, storageAccountName, storageAccount } from "../storage/storageAccount";
import { ResourceGroup } from "../resourceGroup"; 

import { imageBuilds } from "../dockerImages"; // Ensure correct import

const config = new pulumi.Config(); 
const location = config.require("location");

const appVersion = config.get("appVersion") || "5.1.1";
const appEnv = config.get("appEnv") || "prod";
const mauticWebUrl = config.get("mauticWebUrl") || "http://mautic-web:9000";
const mauticServerName = config.get("mauticServerName") || "mautic-nginx";

// const dbHost = config.require("dbHost");
// const dbPort = config.require("dbPort");
// const dbName = config.require("dbName");

// Adjust 'acrCredentials' to use 'ResourceGroup.name'
const acrCredentials = pulumi.all([marketingcr.name, ResourceGroup.name]).apply(([registryName, resourceGroupName]) => 
    azure_native.containerregistry.listRegistryCredentials({
        registryName: registryName,
        resourceGroupName: resourceGroupName
    })
);

export function mauticNginx(args: {
    env: string;
    image: pulumi.Input<string>;
    registryUrl: pulumi.Input<string>;
    registryUsername: pulumi.Input<string>;
    registryPassword: pulumi.Input<string>;
    managedEnvironmentId: pulumi.Input<string>;
    storageName: pulumi.Input<string>;
    storageMountPath: string;
    dbHost: pulumi.Input<string>;
    dbPort: pulumi.Input<string>;
    dbName: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>;
    staticSiteContainer: pulumi.Input<string>;
}) {

    return new azure_native.app.ContainerApp("mautic-nginx", {
        configuration: {
            activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
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
            type: azure_native.app.ManagedServiceIdentityType.None,
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
                    {
                        name: "MAUTIC_STORAGE_STATIC_WEB",
                        value: args.staticSiteContainer,
                    }
                ],
                image: args.image, // Use the passed-in image parameter
                name: "mautic-nginx",
                resources: {
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: [
                    {
                        mountPath: "/opt/mautic/cron",
                        volumeName: "cron",
                    },
                    {
                        mountPath: "/var/www/html/config",
                        volumeName: "config",
                    },
                    {
                        mountPath: "/var/www/html/logs",
                        volumeName: "logs",
                    },
                    {
                        mountPath: "/var/www/html/media/files",
                        volumeName: "files",
                    },
                    {
                        mountPath: "/var/www/html/media/images",
                        volumeName: "images",
                    },
                    {
                        mountPath: "/var/www/html/docroot",
                        volumeName: "docroot",
                    },
                    {
                        mountPath: "/var/www",
                        volumeName: "www",
                    },
                ],
            }],
            revisionSuffix: "",
            scale: {
                maxReplicas: 10, 
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
            volumes: [
                {
                    name: "cron",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
                {
                    name: "config",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
                {
                    name: "logs",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
                {
                    name: "files",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
                {
                    name: "images",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
                {
                    name: "docroot",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
                {
                    name: "www",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
            ],
        },
    }, {
        protect: false,
        dependsOn: [mauticAppFilesStorage, storageAccount, imageBuilds["marketing-nginx"]], // Reference centralized image build
    });
}