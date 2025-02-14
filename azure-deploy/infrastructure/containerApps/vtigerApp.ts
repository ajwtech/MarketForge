import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import * as pulumi from "@pulumi/pulumi";
import { imageBuilds } from "../dockerImages";
import { storageAccount} from "../storage/storageAccount";


const config = new pulumi.Config();
const location = config.require("location");
const vtigerAppUrl = config.get("vtigerAppUrl") || "vtiger-app";


interface VtigerAppArgs {
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
    appSecret: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>;
    siteFQDN: pulumi.Output<string>;
    siteUrl: pulumi.Output<string>;
    crmSubdomain: pulumi.Input<string>;
    domain: pulumi.Input<string>;
}

export function vtigerApp(args: VtigerAppArgs) {
    const imageDigest = imageBuilds["marketing-vtiger-app"].digest;
    const revisionSuffix = imageDigest.apply(digest => digest.replace(/[^a-zA-Z0-9]/g, "").substring(0, 12));

    return new azure_app.ContainerApp(vtigerAppUrl, {
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
                containerAppName: "vtiger-app",
                environmentId: args.managedEnvironmentId,
                identity: {
                    type: azure_app.ManagedServiceIdentityType.None,
                },
                location: location,
                
                template: {
                    containers: [{
                        name: "vtiger-app",
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
                    { name: "APP_SECRET", value: args.appSecret },
                    { name: "SITE_URL", value: args.siteUrl },
                    { name: "SITE_FQDN", value: args.siteFQDN },
                    { name: "STORAGE_ACCOUNT_NAME", value: args.storageName },

                ],
                resources: {
                    cpu: 0.75,
                    memory: "1.5Gi",
                },
                volumeMounts: [{
                    mountPath: "/var/vtiger/www/html/uploads",
                    volumeName: "vtiger-app-uploads",
                    subPath: "",
                    }],
            }],
            //revisionSuffix: revisionSuffix,
            scale: {
                minReplicas: 1,
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
                name: "vtiger-app-uploads",
                storageName: args.storageName, // ensure args.storageName points to your Storage Account name
                storageType: azure_app.StorageType.AzureFile,
            }],
        },
    },{
        dependsOn:[storageAccount, imageBuilds["marketing-vtiger-app"]],
    });
}
