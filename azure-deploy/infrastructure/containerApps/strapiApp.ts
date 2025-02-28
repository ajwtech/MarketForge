// Import necessary modules and resources
import * as pulumi from "@pulumi/pulumi";

import { strapiAppFilesStorage, storageAccountKey, storageAccountName, storageAccount } from "../storage/storageAccount";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

import { imageBuilds } from "../dockerImages"; // Ensure correct import

const config = new pulumi.Config(); 
const strapiAppUrl = config.get("strapiAppUrl") || "strapi-app";
const domain = config.require("domain");
const cmsSubdomain = config.get("cmsSubdomain") || "cms";

export function strapiApp(args: {
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
    dbUser: pulumi.Input<string>;
    dbPassword: pulumi.Input<string>;
    dbClient: pulumi.Input<string>;
    jwtSecret: pulumi.Input<string>;
    adminJwtSecret: pulumi.Input<string>;
    appKeys: pulumi.Input<string>;
    nodeEnv: pulumi.Input<string>;
    apiToken: pulumi.Input<string>;
}) {
    const imageDigest = imageBuilds["marketing-strapi-app"].digest;

    return new azure_app.ContainerApp(strapiAppUrl, {
        configuration: {
            activeRevisionsMode: azure_app.ActiveRevisionsMode.Single,
            ingress: {
                allowInsecure: false,
                clientCertificateMode: "Ignore",
                external: true,
                targetPort: 1337,
                traffic: [{
                    latestRevision: true, 
                    weight: 100,
                }],
                customDomains: [
                    { bindingType: 'Disabled', name: `${cmsSubdomain}.${domain}` },
                ],
                transport: "Auto", 
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
        containerAppName: strapiAppUrl,
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
                        name: "DB_USER",
                        value: args.dbUser, 
                    },
                    {
                        name: "DB_PASSWORD",
                        value: args.dbPassword, 
                    },
                    {
                        name: "DATABASE_CLIENT",
                        value: args.dbClient, 
                    },
                    {
                        name: "JWT_SECRET",
                        value: args.jwtSecret, 
                    },
                    {
                        name: "ADMIN_JWT_SECRET",
                        value: args.adminJwtSecret, 
                    },
                    {
                        name: "APP_KEYS",
                        value: args.appKeys, 
                    },
                    {
                        name: "NODE_ENV",
                        value: args.nodeEnv, 
                    },
                    {
                        name: "API_TOKEN_SALT",
                        value: args.apiToken, 
                    },
                    // Use a dummy variable to force revision updates when the image changes.
                    {
                        name: "DEPLOY_TRIGGER",
                        value: imageDigest,
                    },
                ],
                image: args.image, // Use the passed-in image parameter
                name: strapiAppUrl,
                resources: {
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: [
                    {
                        mountPath: "/opt/app/config",   
                        volumeName: "config",
                        subPath: "config/strapi",            
                    },
                    {
                        mountPath: "/opt/app/src",  
                        volumeName: "src",
                        subPath: "src",   
                    },
                    {
                        mountPath: "/opt/package.json",  
                        volumeName: "packagejson",
                        subPath: "package.json",   
                    },
                    {
                        mountPath: "/opt/yarn.lock",  
                        volumeName: "yarnlock",
                        subPath: "yarn.lock",   
                    },
                    {
                        mountPath: "/opt/app/.env",  
                        volumeName: "env",
                        subPath: ".env",   
                    },
                    {
                        mountPath: "/opt/app/public/uploads",  
                        volumeName: "uploads",
                        subPath: "uploads",   
                    },

                ],
            }],
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
                    name: "config",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                },
                {
                    name: "src",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                }, 
                {
                    name: "packagejson",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                },   
                {
                    name: "yarnlock",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                },   
                {
                    name: "env",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                },   
                {
                    name: "uploads",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                },               
            ],
        },
        
    },{
        
        protect: false,
        dependsOn: [strapiAppFilesStorage, storageAccount, imageBuilds["marketing-strapi-app"]],
    });
}