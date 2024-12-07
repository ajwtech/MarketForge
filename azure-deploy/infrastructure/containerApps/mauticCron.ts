import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { storageAccountName, storageAccount } from "../storage/storageAccount";
import { imageBuilds } from "../dockerImages"; 
const config = new pulumi.Config();
const location = config.require("location");


export function mauticCron(args: {
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
    resourceGroupName: pulumi.Input<string>; 
    storageAccountKey: pulumi.Input<string>; 
}) {


    return new azure_native.app.ContainerApp("mautic-cron", {
        configuration: {
            activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
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
        containerAppName: "mautic-cron",
        environmentId: args.managedEnvironmentId,
        identity: {
            type: azure_native.app.ManagedServiceIdentityType.None,
        },
        location: location,
        managedEnvironmentId: args.managedEnvironmentId,
        resourceGroupName: args.resourceGroupName, 
        template: {
            containers: [{
                env: [
                    { name: "APP_ENV", value: args.env },
                    { name: "DB_HOST", value: args.dbHost },
                    { name: "DB_PORT", value: args.dbPort },
                    { name: "DB_NAME", value: args.dbName },
                    { name: "DB_USER", value: args.dbUser },
                    { name: "DB_PASSWORD", value: args.dbPassword },
                    { name: "APP_SECRET", value: args.appSecret },
                    {
                        name: "MAUTIC_ROLE",
                        value: "mautic_cron",
                    },
                    {
                        name: "STORAGE_ACCOUNT_NAME",
                        value: storageAccountName,
                    },
                    {
                        name: "STORAGE_ACCOUNT_KEY",
                        value: args.storageAccountKey, 
                    },
                ],
                image: args.image, // Use the passed-in image parameter
                name: "mautic-cron",
                resources: {
                    cpu: 0.5,
                    memory: "1Gi",
                },
                volumeMounts: [
                    {
                        mountPath: args.storageMountPath,
                        volumeName: "storage",
                    },
                    {
                        mountPath: "/opt/mautic/cron",
                        volumeName: "cron",
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
                        mountPath: "/var/www/html/config",
                        volumeName: "config",
                    },
                ],
            }],
            revisionSuffix: "",
            scale: {
                maxReplicas: 1,
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
                    name: "storage",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
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
            ],
        },
    }, {
        protect: false,
        dependsOn: [storageAccount, imageBuilds["marketing-mautic_cron"]], 
    });
}