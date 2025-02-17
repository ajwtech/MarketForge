// Import necessary modules and resources
import * as pulumi from "@pulumi/pulumi";

import { storageAccountKey, storageAccountName, storageAccount } from "../storage/storageAccount";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

import { imageBuilds } from "../dockerImages"; // Ensure correct import
import { marketing_mysql } from "../database/mysqlServer";

const config = new pulumi.Config(); 

export function jumpBox(args: {
    env: string;
    managedEnvironmentId: pulumi.Input<string>;
    storageName: pulumi.Input<string>;
    dbHost: pulumi.Input<string>;
    dbPort: pulumi.Input<string>;
    resourceGroupName: pulumi.Input<string>;
}) {return new azure_app.ContainerApp("ubuntu-sshd", {
        configuration: {
            activeRevisionsMode: azure_app.ActiveRevisionsMode.Single,
            ingress: {
                external: true,
                targetPort: 22,
                exposedPort: 2222,
                traffic: [{
                    latestRevision: true, 
                    weight: 100,
                }],
                transport: "Tcp",
            },
            maxInactiveRevisions: 100,
            secrets: [
            {
                name: "root-password-secret",
                value: "rooTaccesShaSbeenGranted!",
            },
            ],
        },
        containerAppName: "jumpbox",
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
                        name: "ROOT_PASSWORD",
                        secretRef: "root-password-secret",
                    },

                ],
                args: ["echo 'root:$ROOT_PASSWORD' | chpasswd && exec /usr/sbin/sshd -D"],
                image: "docker.io/rastasheep/ubuntu-sshd", // Using rastasheep/ubuntu-sshd from docker.io
                name: "ubuntu-sshd",
                resources: {
                    cpu: 0.25,
                    memory: "0.5Gi",
                },
                volumeMounts: [
                    {
                        mountPath: "/var/log",   // Nginx writes logs here
                        volumeName: "log",
                        subPath: "log",            // Maps to /log/nginx in the file share
                    }

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
                            tcpConnections: "100", 
                        },
                    },
                }],
            },
            volumes: [
                {
                    name: "log",
                    storageName: args.storageName,
                    storageType: azure_app.StorageType.AzureFile,
                }           
            ],
        },
        
    },{
        protect: false,
        dependsOn: [marketing_mysql, storageAccount], // Reference centralized image build
    });
}