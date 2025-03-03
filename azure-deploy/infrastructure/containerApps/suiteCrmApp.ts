import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import * as pulumi from "@pulumi/pulumi";
import { imageBuilds } from "../dockerImages";
import { storageAccount} from "../storage/storageAccount";


const config = new pulumi.Config();
const location = config.require("location");
const suitecrmAppUrl = config.get("suitecrmAppUrl") || "suitecrm-app";


interface suitecrmAppArgs {
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
    dbType: pulumi.Input<string>;
    dbVersion: pulumi.Input<string>;
    dbCharset: pulumi.Input<string>;
    appSecret: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>;
    siteFQDN: pulumi.Output<string>;
    siteUrl: pulumi.Output<string>;
    crmSubdomain: pulumi.Input<string>;
    domain: pulumi.Input<string>;
}

export function suitecrmApp(args: suitecrmAppArgs) {
    const imageDigest = imageBuilds["marketing-suitecrm-app"].digest;

    return new azure_app.ContainerApp(suitecrmAppUrl, {
        resourceGroupName: args.resourceGroupName,
        managedEnvironmentId: args.managedEnvironmentId,
        configuration: {
                    activeRevisionsMode: azure_app.ActiveRevisionsMode.Single,
                    ingress: {
                        external: false,
                        targetPort: 9000,
                        traffic: [{
                            latestRevision: true,
                            weight: 100,
                        }],
                        transport: "tcp",

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
                containerAppName: "suitecrm-app",
                environmentId: args.managedEnvironmentId,
                identity: {
                    type: azure_app.ManagedServiceIdentityType.None,
                },
                location: location,
                
                template: {
                    containers: [{
                        name: "suitecrm-app",
                        image: args.image,
                        env: [
                    { name: "APP_ENV", value: args.env },
                    { name: "DB_HOST", value: args.dbHost },
                    { name: "DB_PORT", value: args.dbPort },
                    { name: "DB_NAME", value: args.dbName },
                    { name: "DB_USER", value: args.dbUser },
                    { name: "DB_PASSWORD", value: args.dbPassword },
                    { name: "DB_TYPE", value: args.dbType },
                    { name: "DB_NAME", value: args.dbName },
                    { name: "DB_VERSION", value: args.dbVersion },
                    { name: "DB_CHARSET", value: args.dbCharset },
                    { name: "APP_SECRET", value: args.appSecret },
                    { name: "SITE_URL", value: args.siteUrl },
                    { name: "SITE_FQDN", value: args.siteFQDN },
                    { name: "STORAGE_ACCOUNT_NAME", value: args.storageName },
                    // Use a dummy variable to force revision updates when the image changes.
                    {
                        name: "DEPLOY_TRIGGER",
                        value: imageDigest,
                    },

                ],
                resources: {
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: [
                    {
                        mountPath: "/var/suitecrm/www/html/uploads",
                        volumeName: "suitecrm-app-uploads",
                        subPath: "suitecrm-app-uploads",
                    },
                    {
                        mountPath: "/var/suitecrm/www/html/logs",
                        volumeName: "suitecrm-app-logs",
                        subPath: "log/suitecrm-app-logs",
                    },
                    {
                        mountPath: "/var/log",
                        volumeName: "suitecrm-app-logs",
                        subPath: "log/suitecrm-app-logs/var-log",
                    },
                    {
                        mountPath: "/mnt/persistent-config",
                        volumeName: "suitecrm-app-config",
                        subPath: "config/suitecrm",
                    },
                    {
                        mountPath: "/var/suitecrm/www/html/public/legacy/cache",
                        volumeName: "suitecrm-app-cache",
                        subPath: "cache",
                    },
                ],
            }],
            scale: {
                minReplicas: 0,  // Changed from 1 to 0 to allow scale to zero
                maxReplicas: 3,
                rules: [{
                    name: "tcp-scaler",
                    tcp: {
                        metadata: {
                            concurrentRequests: "100",
                        },
                    },
                }],
            },
            volumes: [{
                name: "suitecrm-app-uploads",
                storageName: args.storageName, 
                storageType: azure_app.StorageType.AzureFile,
            },
            {
                name: "suitecrm-app-logs",
                storageName: args.storageName,
                storageType: azure_app.StorageType.AzureFile
            },
            {
                name: "suitecrm-app-config",
                storageName: args.storageName,
                storageType: azure_app.StorageType.AzureFile
            },
            {
                name: "suitecrm-app-cache",
                storageName: args.storageName,
                storageType: azure_app.StorageType.AzureFile
            }
        ],
        },
    },{
        dependsOn:[storageAccount, imageBuilds["marketing-suitecrm-app"]],
    });
}
