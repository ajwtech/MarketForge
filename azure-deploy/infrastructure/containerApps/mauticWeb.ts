import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { acrUsername, acrPassword, registryUrl } from "../registries/acrRegistry";
import { marketing_env } from "../../index";
import { storageAccountName, storageAccountKey, mauticAppFilesStorage, storageAccount } from "../storage/storageAccount";
import { nginxUrl } from "./mauticNginx";
import { imageBuilds } from "../dockerImages"; 

const config = new pulumi.Config();
const location = config.require("location");

export function mauticWeb(args: {
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
    dbUser: pulumi.Input<string>;
    dbPassword: pulumi.Input<string>;
    appSecret: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>; // Add this line
}) {
    return new azure_native.app.ContainerApp("mautic-web", {
        configuration: {
            activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
            ingress: {
                external: false,
                targetPort: 9000,
                traffic: [{
                    latestRevision: true,
                    weight: 100,
                }],
                transport: "Tcp",
            },
            maxInactiveRevisions: 100,
            registries: [{
                server: args.registryUrl,
                username: args.registryUsername,
                passwordSecretRef: "registry-password",
            }],
            secrets: [{
                name: "registry-password",
                value: args.registryPassword,
            }],
        },
        containerAppName: "mautic-web",
        environmentId: marketing_env.id,
        identity: {
            type: azure_native.app.ManagedServiceIdentityType.None,
        },
        location: location,
        managedEnvironmentId: args.managedEnvironmentId,
        resourceGroupName: args.resourceGroupName, // Use the passed-in resourceGroupName
        template: {
            containers: [{
                name: "mautic-web",
                image: imageBuilds["marketing-mautic_web"].imageName, 
                env: [
                    { name: "APP_ENV", value: args.env },
                    { name: "DB_HOST", value: args.dbHost },
                    { name: "DB_PORT", value: args.dbPort },
                    { name: "DB_NAME", value: args.dbName },
                    { name: "DB_USER", value: args.dbUser },
                    { name: "DB_PASSWORD", value: args.dbPassword },
                    { name: "APP_SECRET", value: args.appSecret },
                    {
                        name: "APP_VERSION",
                        value: "5.1.1",
                    },
                    {
                        name: "MAUTIC_ROLE",
                        value: "mautic_web",
                    },
                    {
                        name: "APP_DEBUG",
                        value: "1",
                    },
                    {
                        name: "SITE_URL",
                        value: nginxUrl.apply(url => `https://${url}`), // Use nginxUrl here
                    },
                    {
                        name: "STORAGE_ACCOUNT_KEY",
                        value: storageAccountKey,
                    },
                    {
                        name: "STORAGE_ACCOUNT_NAME",
                        value: storageAccountName,
                    },
                ],
                resources: {
                    cpu: 1,
                    memory: "2Gi",
                },
                volumeMounts: [
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
                        mountPath: "/opt/mautic/cron",
                        volumeName: "cron",
                    },
                    {
                        mountPath: "/var/www/html",
                        volumeName: "docroot",
                    },
                ],
            }],
            initContainers: [{
                env: [
                    {
                        name: "MAUTIC_ROLE",
                        value: "mautic_init",
                    },
                    {
                        name: "APP_ENV",
                        value: "prod",
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
                        name: "FILE_SHARE_NAME",
                        value: "mautic-app-files",
                    },
                ],
                image: args.image, // Use the passed-in image parameter
                name: "init-rsync",
                resources: {
                    cpu: 0.25,
                    memory: "0.5Gi",
                },
                volumeMounts: [{
                    mountPath: "/datastore",
                    volumeName: "datastore",
                }],
            }],
            revisionSuffix: "",
            scale: {
                maxReplicas: 10,
                minReplicas: 0,
                rules: [{
                    name: "tcp-scaler",
                    tcp: {
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
                    name: "datastore",
                    storageName: mauticAppFilesStorage.name,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
            ],
        },
    }, {
        protect: false,
        dependsOn: [storageAccount, imageBuilds["marketing-mautic_web"]], 
    });
}