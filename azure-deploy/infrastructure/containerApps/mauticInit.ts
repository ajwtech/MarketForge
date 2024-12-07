import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { storageAccount, storageAccountKey, storageAccountName } from "../storage/storageAccount";
import { imageBuilds } from "../dockerImages"; 


const config = new pulumi.Config();

const appEnv = config.get("appEnv") || "prod";


// Define the initContainer separately if needed
export function mauticInit(args: {
    env: string;
    image: pulumi.Input<string>;
    registryUrl: pulumi.Input<string>;
    registryUsername: pulumi.Input<string>;
    registryPassword: pulumi.Input<string>;
    managedEnvironmentId: pulumi.Input<string>;
    storageName: pulumi.Input<string>;
    storageMountPath: string;
    resourceGroupName: pulumi.Input<string>;
    storageAccountKey: pulumi.Input<string>;
}) {
    return new azure_native.app.ContainerApp("mautic-init", {
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
        containerAppName: "mautic-init",
        environmentId: args.managedEnvironmentId,
        identity: {
            type: azure_native.app.ManagedServiceIdentityType.None,
        },
        location: config.require("location"),
        managedEnvironmentId: args.managedEnvironmentId,
        resourceGroupName: args.resourceGroupName,
        template: {
            // initContainers: [{
            //     env: [
            //         {
            //             name: "MAUTIC_ROLE",
            //             value: "mautic_init",
            //         },
            //         {
            //             name: "APP_ENV",
            //             value: appEnv,
            //         },
            //         {
            //             name: "STORAGE_ACCOUNT_NAME",
            //             value: storageAccountName, 
            //         },
            //         {
            //             name: "STORAGE_ACCOUNT_KEY",
            //             value: storageAccountKey, 
            //         },
            //         {
            //             name: "FILE_SHARE_NAME",
            //             value: args.storageName,
            //         },
            //     ],
            //     image: args.image, // Use the passed-in image parameter
            //     name: "init-rsync",
            //     resources: {
            //         cpu: 0.25,
            //         memory: "0.5Gi",
            //     },
            //     volumeMounts: [{
            //         mountPath: "/datastore",
            //         volumeName: "datastore",
            //     }],
            // }],
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
                    name: "datastore",
                    storageName: args.storageName,
                    storageType: azure_native.app.StorageType.AzureFile,
                },
            ],
        },
    }, {
        protect: false,
        dependsOn: [storageAccount, imageBuilds["marketing-mautic_init"]],
    });
}