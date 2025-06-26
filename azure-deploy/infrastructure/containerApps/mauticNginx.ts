// Import necessary modules and resources
import * as pulumi from "@pulumi/pulumi";

import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

import { imageBuilds } from "../dockerImages"; 

const config = new pulumi.Config(); 
const nginxServerName = config.get("nginxServerName") || "mautic-nginx";
const mauticWebUrl = config.get("mauticWebUrl") || "mautic-web";
const strapiAppUrl = config.get("strapiAppUrl") || "strapi-app";
const suiteCrmAppUrl = config.get("suiteCrmAppUrl") || "suitecrm-app";
const domain = config.require("domain");
const crmSubdomain = config.get("crmSubdomain") || "crm";
const mapSubdomain = config.get("mapSubdomain") || "map";
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const loggingEnabled = config.get("nginxLoggingEnabled") || "off"; // Default to false if not set

export function mauticNginx(args: {
    env: string;
    image: pulumi.Input<string>;
    registryUrl: pulumi.Input<string>;
    registryUsername: pulumi.Input<string>;
    registryPassword: pulumi.Input<string>;
    managedEnvironmentId: pulumi.Input<string>;
    storageName: pulumi.Input<string>;
    suiteCrmStorageName: pulumi.Input<string>;
    dbHost: pulumi.Input<string>;
    dbPort: pulumi.Input<string>;
    dbName: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>;
    createSubdomains: pulumi.Input<boolean>;
    storageAccountName: pulumi.Input<string>; // added
    storageAccountKey: pulumi.Input<string>;  // added
    azureFunctionUrl?: pulumi.Input<string>; // Add Azure Function URL (optional)
}) {
   
    const imageTag = imageBuilds["marketing-nginx"];

    // Get environment variables including logging controls
    const envVars = [
        {
            name: "MAUTIC_WEB_URL",
            value: mauticWebUrl,
        },
        {
            name: "STRAPI_APP_URL", 
            value: strapiAppUrl,
        },
        {
            name: "SUITECRM_APP_URL", 
            value: suiteCrmAppUrl,
        },
        // {
        //     name: "FRONTEND_APP_URL",
        //     value: args.azureFunctionUrl,
        // },
        {
            name: "MAUTIC_SERVER_NAME",
            value: nginxServerName,
        },
        {
            name: "STORAGE_ACCOUNT_NAME",
            value: args.storageAccountName,
        },
        {
            name: "STORAGE_ACCOUNT_KEY",
            value: args.storageAccountKey,
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
        // Logging environment variables
        {
            name: "NGINX_LOGGING_ENABLED",
            value: loggingEnabled,
        },
        {
            name: "NGINX_ACCESS_LOG_ENABLED",
            value: "",  // Use default
        },
        {
            name: "NGINX_ERROR_LOG_ENABLED", 
            value: "",  // Use default
        },
        {
            name: "NGINX_DEBUG_LOG_ENABLED",
            value: "",  // Use default
        },
        {
            name: "NGINX_STATIC_LOG_ENABLED",
            value: "off",  // Always off for static content
        },
        {
            name: "DEPLOY_TRIGGER",
            value: imageTag,
        }
    ];

    // Prepare volume mounts
    const volumeMounts = [
        {
            mountPath: "/var/log",   // Nginx writes logs here
            volumeName: "log",
            subPath: "log/nginx",            // Maps to /log/nginx in the file share
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
        {
            mountPath: "/var/suitecrm/www/html/public/legacy/cache",
            volumeName: "suitecrm-app-cache",
            subPath: "cache",
        }
    ];



    // Prepare volumes
    const volumes = [
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
        {
            name: "suitecrm-app-cache",
            storageName: args.suiteCrmStorageName,
            storageType: azure_app.StorageType.AzureFile
        }
    ];



    return new azure_app.ContainerApp("mautic-nginx", {

        configuration: {
            activeRevisionsMode: azure_app.ActiveRevisionsMode.Single,
            ingress: {
                allowInsecure: false,
                clientCertificateMode: "Ignore",
                external: true,
                targetPort: 80,
                additionalPortMappings: [{
                    targetPort: 5173,
                    external: true,
                }],
                traffic: [{
                    latestRevision: true, 
                    weight: 100,
                }],
                transport: "Auto",
                customDomains: [
                    { bindingType: 'SniEnabled', name: `${mapSubdomain}.${domain}` },
                    { bindingType: 'SniEnabled', name: `${crmSubdomain}.${domain}` },
                ] ,
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
                env: envVars,
                image: args.image, // Use the passed-in image parameter
                name: "mautic-nginx",
                resources: {
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: volumeMounts,
            }],
            scale: {
                maxReplicas: 3, 
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
            volumes: volumes,
        },
        
    },{
        replaceOnChanges: ["image", "createSubdomains" ],
        protect: false,
    });
}