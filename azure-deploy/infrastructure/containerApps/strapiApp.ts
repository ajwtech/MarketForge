// Import necessary modules and resources
import * as pulumi from "@pulumi/pulumi";

import {devStrapiFiles, strapiFiles, strapiAppFilesStorage, storageAccountKey, storageAccountName, storageAccount } from "../storage/storageAccount";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

import { imageBuilds } from "../dockerImages"; // Ensure correct import

const config = new pulumi.Config(); 
const strapiAppUrl = config.get("strapiAppUrl") || "strapi-app";
const devStrapiAppUrl = config.get("devStrapiAppUrl") || "dev-strapi-app";
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
    transferTokenSalt: pulumi.Input<string>;
    cmsUrl: pulumi.Input<string>;
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
            maxInactiveRevisions: 50,
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
                        
                        name: "NODE_ENV",
                        value: args.nodeEnv, 
                    },
                    {
                        name: "DOMAIN",
                        value: `${cmsSubdomain}.${domain}`,
                    },

                    {
                        name: "STORAGE_ACCOUNT_KEY",
                        value: storageAccountKey,
                    },
                    {
                        name: "DATABASE_HOST",
                        value: args.dbHost, 
                    },
                    {
                        name: "DATABASE_PORT",
                        value: args.dbPort, 
                    },
                    {
                        name: "DATABASE_NAME",
                        value: args.dbName, 
                    },
                    {
                        name: "DATABASE_USERNAME",
                        value: args.dbUser, 
                    },
                    {
                        name: "DATABASE_PASSWORD",
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
                        name: "API_TOKEN_SALT",
                        value: args.apiToken, 
                    },
                    // Use a dummy variable to force revision updates when the image changes.
                    {
                        name: "DEPLOY_TRIGGER",
                        value: imageDigest,
                    },
                ],
                image: args.image,
                name: strapiAppUrl,
                resources: {
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: [
                    {
                        mountPath: "/opt/app/config",   
                        volumeName: "config",
                        subPath: "app/config",            
                    },
                    {
                        mountPath: "/opt/app/src",  
                        volumeName: "src",
                        subPath: "app/src",   
                    },
                    {
                        mountPath: "/opt/app/public/uploads",  
                        volumeName: "uploads",
                        subPath: "uploads",   
                    },

                ],
            }],
            scale: {
                maxReplicas: 2, 
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
                    name: "uploads",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                },               
            ],
        },
        
    },{
        
        protect: false,
        dependsOn: [strapiFiles, strapiAppFilesStorage, storageAccount, imageBuilds["marketing-strapi-app"]],
    });
}

export function devStrapiApp(args: {
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
    transferTokenSalt: pulumi.Input<string>;
    cmsUrl: pulumi.Input<string>;
}) {
    const imageDigest = imageBuilds["marketing-dev-strapi-app"].digest;

    return new azure_app.ContainerApp(devStrapiAppUrl, {
        configuration: {
            activeRevisionsMode: azure_app.ActiveRevisionsMode.Single,
            ingress: {
                external: false,
                targetPort: 1337,
                traffic: [{
                    latestRevision: true, 
                    weight: 100,
                }],
                transport: "TCP", 
                additionalPortMappings: [{
                    external: false,
                    targetPort: 5173,
                }],
            },
            maxInactiveRevisions: 10,
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
        containerAppName: devStrapiAppUrl,
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
                        name: "NODE_ENV",
                        value: "development",
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
                        name: "DATABASE_HOST",
                        value: args.dbHost, 
                    },
                    {
                        name: "DATABASE_PORT",
                        value: args.dbPort, 
                    },
                    {
                        name: "DATABASE_NAME",
                        value: args.dbName, 
                    },
                    {
                        name: "DATABASE_USERNAME",
                        value: args.dbUser, 
                    },
                    {
                        name: "DATABASE_PASSWORD",
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
                        name: "API_TOKEN_SALT",
                        value: args.apiToken, 
                    },
                    {
                        name: "TRANSFER_TOKEN_SALT",
                        value: args.transferTokenSalt,
                    },
                    {
                        name: "CMS_URL",
                        value: args.cmsUrl, 
                    },
                    {
                        name: "DOMAIN",
                        value: `dev.${cmsSubdomain}.${domain}`,
                    },
                    // Use a dummy variable to force revision updates when the image changes.
                    {
                        name: "DEPLOY_TRIGGER",
                        value: imageDigest,
                    },
                ],
                image: args.image,
                name: devStrapiAppUrl,
                resources: {
                    cpu: 1.5,
                    memory: "3.0Gi",
                },
                volumeMounts: [
                    {
                        mountPath: "/opt/app/config",   
                        volumeName: "config",
                        subPath: "app/config",            
                    },

                    {
                        mountPath: "/opt/app/src",  
                        volumeName: "app",
                        subPath: "app/src",   
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
                minReplicas: 0,
                rules: [{
                    name: "http-scaler", 
                    http: { 
                        metadata: {
                            concurrentRequests: "50", 
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
                    name: "app",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                }, 
                {
                    name: "log",
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
        dependsOn: [devStrapiFiles, strapiAppFilesStorage, storageAccount, imageBuilds["marketing-strapi-app"]],
    });
}