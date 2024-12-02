// Import necessary modules and resources
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import * as docker from "@pulumi/docker";
import { marketingcr } from "../registries/acrRegistry";
import { mauticAppFilesStorage, storageAccountKey, storageAccountName } from "../storage/storageAccount";
import { ResourceGroup } from "../resourceGroup"; 
import { marketing_env } from "../managedEnvironment/managedEnvironment"; 
import { imageBuilds } from "../dockerImages"; // Ensure correct import

const config = new pulumi.Config(); 
const location = config.require("location");

const appVersion = config.get("appVersion") || "5.1.1";
const appEnv = config.get("appEnv") || "prod";
const mauticWebUrl = config.get("mauticWebUrl") || "http://mautic-web:9000";
const mauticServerName = config.get("mauticServerName") || "mautic-nginx";

const dbHost = config.require("dbHost");
const dbPort = config.require("dbPort");
const dbName = config.require("dbName");

// Adjust 'acrCredentials' to use 'ResourceGroup.name'
const acrCredentials = pulumi.all([marketingcr.name, ResourceGroup.name]).apply(([registryName, resourceGroupName]) => 
    azure_native.containerregistry.listRegistryCredentials({
        registryName: registryName,
        resourceGroupName: resourceGroupName
    })
);

const acrUsername = acrCredentials.apply(creds => creds.username || "");
const acrPassword = acrCredentials.apply(creds => (creds.passwords && creds.passwords[0].value) || "");
const registryUrl = marketingcr.loginServer;
const imageTag = "latest"; 

export const mauticNginx = new azure_native.app.ContainerApp("mautic-nginx", {
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
            server: marketingcr.loginServer.apply(server => server || ""),
            username: acrUsername,
        }],
        secrets: [{
            name: "acr-password",
            value: acrPassword,
        },
        {
            name: "registry-password",
            value: acrPassword, 
        }],
    },
    containerAppName: "mautic-nginx",
    environmentId: marketing_env.id,
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: config.require("location"),
    managedEnvironmentId: marketing_env.id,
    resourceGroupName: ResourceGroup.name, 
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
                    value: dbHost, 
                },
                {
                    name: "DB_PORT",
                    value: dbPort, 
                },
                {
                    name: "DB_NAME",
                    value: dbName, 
                },
                
            ],
            image: imageBuilds["marketing-nginx"].imageName, // Reference centralized image build
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
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "docroot",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "www",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            // ...existing volumes...
        ],
    },
}, {
    protect: false,
    dependsOn: [mauticAppFilesStorage, imageBuilds["marketing-nginx"]], // Reference centralized image build
});

// Export the URL of the nginx ContainerApp
export const nginxUrl = mauticNginx.configuration.apply(config =>
    config?.ingress?.fqdn || ""
);