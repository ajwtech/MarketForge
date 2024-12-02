import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import * as docker from "@pulumi/docker";
import { marketingcr } from "../registries/acrRegistry";
import { marketing_env } from "../managedEnvironment/managedEnvironment";
import { storageAccount, storageAccountKey } from "../storage/storageAccount";
import { imageBuilds } from "../dockerImages"; 

const config = new pulumi.Config();

const appEnv = config.get("appEnv") || "prod";
const storageAccountName = config.require("storageAccountName");
const imageTagConfig = config.get("imageTag") || "latest";

const acrCredentials = marketingcr.name.apply(registryName => 
    azure_native.containerregistry.listRegistryCredentials({
        registryName: registryName,
        resourceGroupName: marketingcr.resourceGroupName,
    })
);

const acrUsername = acrCredentials.apply(creds => creds.username || "");
const acrPassword = acrCredentials.apply(creds => (creds.passwords && creds.passwords[0].value) || "");
const registryUrl = marketingcr.loginServer;
const imageTag = "latest"; 

// Define the initContainer separately if needed
export const mautic_init = new azure_native.app.ContainerApp("mautic-init", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        maxInactiveRevisions: 100,
        registries: [{
            identity: "",
            passwordSecretRef: "registry-password",
            server: registryUrl,
            username: acrUsername,
        }],
        secrets: [{
            name: "registry-password",
            value: acrPassword,
        }],
    },
    containerAppName: "mautic-init",
    environmentId: marketing_env.id,
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: config.require("location"),
    managedEnvironmentId: marketing_env.id,
    resourceGroupName: marketingcr.resourceGroupName,
    template: {
        initContainers: [{
            env: [
                {
                    name: "MAUTIC_ROLE",
                    value: "mautic_init",
                },
                {
                    name: "APP_ENV",
                    value: appEnv,
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
            image: imageBuilds["marketing-mautic_init"].imageName, 
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
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: false,
    dependsOn: imageBuilds["marketing-mautic_init"],
});