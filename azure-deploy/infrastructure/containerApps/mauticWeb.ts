import * as pulumi from "@pulumi/pulumi";
import { storageAccountName, storageAccountKey, storageAccount, configFilePlaceholder } from "../storage/storageAccount";
import { imageBuilds } from "../dockerImages";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

const config = new pulumi.Config();
const location = config.require("location");
const appVersion = config.get("appVersion") || "5.2.2";
export function mauticWeb(args: {
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
    dbUser: pulumi.Input<string>;
    dbPassword: pulumi.Input<string>;
    appSecret: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>;
    siteFQDN: pulumi.Output<string>

}) {
    const imageDigest = imageBuilds["marketing-mautic-app"].digest;
    // const revisionSuffix = imageDigest.apply(digest => digest.replace(/[^a-zA-Z0-9]/g, "").substring(0, 12));

    return new azure_app.ContainerApp("mautic-web", {

        configuration: {
            activeRevisionsMode: azure_app.ActiveRevisionsMode.Single,
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
        environmentId: args.managedEnvironmentId,
        identity: {
            type: azure_app.ManagedServiceIdentityType.None,
        },
        location: location,
        resourceGroupName: args.resourceGroupName,
        template: {
            containers: [{
                name: "mautic-web",
                image: args.image,
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
                        value: appVersion,
                    },
                    {
                        name: "MAUTIC_ROLE",
                        value: "mautic_web",
                    },
                    {
                        name: "APP_DEBUG",
                        value: "0",
                    },
                    {
                        name: "SITE_URL",
                        value: pulumi.interpolate`https://${args.siteFQDN}`,
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
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: [
                    {
                        mountPath: "/var/www/html/config/local.php",
                        volumeName: "config",
                        subPath: "config/local.php",

                    },
                    {
                        mountPath: "/var/log",
                        volumeName: "log",
                        subPath: "log/web",
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
            //revisionSuffix: revisionSuffix,
            scale: {
                maxReplicas: 3,
                minReplicas: 1,
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
                    name: "config",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                },
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
    }, {
        protect: false,
        dependsOn: [storageAccount, imageBuilds["marketing-mautic-app"], configFilePlaceholder],
    });
}
