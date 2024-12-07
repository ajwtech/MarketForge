import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { storageAccount, storageAccountKey, storageAccountName } from "../storage/storageAccount";
import { imageBuilds } from "../dockerImages"; // Ensure correct import

const config = new pulumi.Config();
const mauticRoleWorker = config.get("mauticRoleWorker") || "mautic_worker";

export function mauticWorker(args: {
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
}) {
    return new azure_native.app.ContainerApp("mautic-worker", {
        configuration: {
            activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
            maxInactiveRevisions: 100,
            registries: [{
                identity: "",
                passwordSecretRef: "registry-password",
                server: args.registryUrl,
                username: args.registryUsername,
            }],
            secrets: [{
                name: "registry-password",
                value: args.registryPassword,
            }],
        },
        containerAppName: "mautic-worker",
        environmentId: args.managedEnvironmentId,
        identity: {
            type: azure_native.app.ManagedServiceIdentityType.None,
        },
        location: config.require("location"),
        managedEnvironmentId: args.managedEnvironmentId,
        resourceGroupName: args.resourceGroupName, // Use the passed-in resourceGroupName
        template: {
            containers: [{
                env: [
                    {
                        name: "MAUTIC_ROLE",
                        value: mauticRoleWorker, // Use config value
                    },
                    {
                        name: "DB_USER",
                        value: args.dbUser, // Use config value
                    },
                    {
                        name: "DB_HOST",
                        value: args.dbHost, // Use config value
                    },
                    {
                        name: "DB_PORT",
                        value: args.dbPort, // Use config value
                    },
                    {
                        name: "DB_NAME",
                        value: args.dbName, // Use config value
                    },
                    {
                        name: "DB_PASSWORD",
                        value: args.dbPassword, // Use config secret
                    },
                    {
                        name: "APP_SECRET",
                        value: args.appSecret, // Use config secret
                    },
                    {
                        name: "STORAGE_ACCOUNT_NAME",
                        value: storageAccountName, // Use config value
                    },
                    {
                        name: "STORAGE_ACCOUNT_KEY",
                        value: storageAccountKey, // Use config secret
                    },
                ],
                image: args.image, // Use the passed-in image parameter
                name: "mautic-worker",
                resources: {
                    cpu: 0.5,
                    memory: "1Gi",
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
                        mountPath: "/var/www/html/docroot",
                        volumeName: "docroot",
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
            ],
        },
    }, {
        protect: false,
        dependsOn: [storageAccount, imageBuilds["marketing-mautic_worker"]], // Reference centralized image build
    });
}