import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";

const marketing_stack_eus2_rg = new azure_native.resources.ResourceGroup("marketing-stack-eus2-rg", {
    location: "eastus2",
    resourceGroupName: "marketing-stack-eus2-rg",
}, {
    protect: true,
});

const vnet = new azure_native.network.VirtualNetwork("marketing-vnet", {
    resourceGroupName: marketing_stack_eus2_rg.name,
    location: marketing_stack_eus2_rg.location,
    addressSpace: {
        addressPrefixes: ["10.0.0.0/16"],
    },
});

const subnet = new azure_native.network.Subnet("marketing-subnet", {
    resourceGroupName: marketing_stack_eus2_rg.name,
    virtualNetworkName: vnet.name,
    addressPrefix: "10.0.1.0/24",
});

const marketingstackstorage = new azure_native.storage.StorageAccount("marketingstackstorage", {
    accessTier: azure_native.storage.AccessTier.Hot,
    accountName: "marketingstackstorage",
    allowBlobPublicAccess: false,
    allowCrossTenantReplication: false,
    allowSharedKeyAccess: true,
    defaultToOAuthAuthentication: false,
    dnsEndpointType: azure_native.storage.DnsEndpointType.Standard,
    enableHttpsTrafficOnly: false,
    encryption: {
        keySource: azure_native.storage.KeySource.Microsoft_Storage,
        requireInfrastructureEncryption: false,
        services: {
            blob: {
                enabled: true,
                keyType: azure_native.storage.KeyType.Account,
            },
            file: {
                enabled: true,
                keyType: azure_native.storage.KeyType.Account,
            },
        },
    },
    kind: azure_native.storage.Kind.StorageV2,
    largeFileSharesState: azure_native.storage.LargeFileSharesState.Enabled,
    location: "eastus2",
    minimumTlsVersion: azure_native.storage.MinimumTlsVersion.TLS1_2,
    networkRuleSet: {
        bypass: azure_native.storage.Bypass.AzureServices,
        defaultAction: azure_native.storage.DefaultAction.Allow,
        ipRules: [{
            action: azure_native.storage.Action.Allow,
            iPAddressOrRange: "68.107.145.160",
        }],
    },
    publicNetworkAccess: azure_native.storage.PublicNetworkAccess.Enabled,
    resourceGroupName: "marketing-stack-eus2-rg",
    routingPreference: {
        publishInternetEndpoints: false,
        publishMicrosoftEndpoints: true,
        routingChoice: azure_native.storage.RoutingChoice.MicrosoftRouting,
    },
    sku: {
        name: azure_native.storage.SkuName.Standard_LRS,
    },
    tags: {
        environment: "marketing-stack-rg",
    },
}, {
    protect: true,
});

const marketing_test = new azure_native.app.ManagedEnvironment("marketing-test", {
    appLogsConfiguration: {
        destination: "log-analytics",
        logAnalyticsConfiguration: {
            customerId: "6e36cce4-73df-477c-b973-957902533579",
        },
    },
    environmentName: "marketing-test",
    location: "East US",
    resourceGroupName: "marketing-stack-eus2-rg",
    vnetConfiguration: {
        infrastructureSubnetId: subnet.id,
        internal: false,
    },
    zoneRedundant: false,
}, {
    protect: true,
});

const mautic_test_web = new azure_native.app.ContainerApp("mautic-test-web", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        ingress: {
            allowInsecure: false,
            exposedPort: 9000,
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
            identity: "",
            passwordSecretRef: "reg-pswd-bc616009-8160",
            server: "marketingcr.azurecr.io",
            username: "marketingcr",
        }],
        secrets: [{
            name: "reg-pswd-bc616009-8160",
        }],
    },
    containerAppName: "mautic-test-web",
    environmentId: "/subscriptions/b20cccb5-66d3-485a-a768-496711f76646/resourceGroups/marketing-stack-eus2-rg/providers/Microsoft.App/managedEnvironments/marketing-test",
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: "East US",
    managedEnvironmentId: marketing_test.id,
    resourceGroupName: "marketing-stack-eus2-rg",
    template: {
        containers: [{
            env: [
                {
                    name: "APP_VERSION",
                    value: "5.1.1",
                },
                {
                    name: "APP_ENV",
                    value: "prod",
                },
                {
                    name: "DB_HOST",
                    value: "marketing-mysql.mysql.database.azure.com",
                },
                {
                    name: "DB_PORT",
                    value: "3306",
                },
                {
                    name: "DB_NAME",
                    value: "mauticdb",
                },
                {
                    name: "DB_USER",
                    value: "mauticuser",
                },
                {
                    name: "DB_PASSWORD",
                    value: "Mauticpassword",
                },
                {
                    name: "APP_SECRET",
                    value: "05476580bb6fb6d44fe4471587fa733b1f0ea1a48ad95bd8f677fbec7cb311fbPS",
                },
                {
                    name: "MAUTIC_ROLE",
                    value: "mautic_web",
                },
                {
                    name: "APP_DEBUG",
                    value: "1",
                },
                {
                    name: "SITE_URL",
                    value: "https://mautic-test.delightfulocean-116a429f.eastus.azurecontainerapps.io",
                },
            ],
            image: "marketingcr.azurecr.io/marketing-mautic_web:latest",
            name: "mautic-test-web",
            resources: {
                cpu: 1,
                memory: "2Gi",
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
                    mountPath: "/var/www/html",
                    volumeName: "docroot",
                },
            ],
        }],
        initContainers: [{
            env: [
                {
                    name: "MAUTIC_ROLE",
                    value: "mautic_init",
                },
                {
                    name: "APP_ENV",
                    value: "prod",
                },
                {
                    name: "STORAGE_ACCOUNT_NAME",
                    value: "marketingstackstorage",
                },
                {
                    name: "STORAGE_ACCOUNT_KEY",
                    value: "aVanumfDnOo5+qxsvTJsh57EiCtX619UR5fNmcPTMsBtE/GvJ63tnqxfLJXXKtMltJkXrJVpoes5+ASt4svj3g==",  
                },
                {
                    name: "FILE_SHARE_NAME",
                    value: "mautic-app-files",
                },
            ],
            image: "marketingcr.azurecr.io/marketing-mautic_init:latest",
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
            maxReplicas: 10,
            minReplicas: 1,
            rules: [{
                name: "tcp-scaler",
                tcp: {
                    metadata: {
                        concurrentConnections: "10",
                    },
                },
            }],
        },
        volumes: [
            {
                name: "cron",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "docroot",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "datastore",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: true,
});

const mautic_test = new azure_native.app.ContainerApp("mautic-test", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        ingress: {
            allowInsecure: true,
            clientCertificateMode: "Ignore",
            exposedPort: 0,
            external: true,
            targetPort: 80,
            traffic: [{
                revisionName: "mautic-test--s3sn2oa",
                weight: 100,
            }],
            transport: "Auto",
        },
        maxInactiveRevisions: 100,
        registries: [{
            identity: "",
            passwordSecretRef: "reg-pswd-9fc8895e-9bdc",
            server: "marketingcr.azurecr.io",
            username: "marketingcr",
        }],
        secrets: [{
            name: "reg-pswd-9fc8895e-9bdc",
        }],
    },
    containerAppName: "mautic-test",
    environmentId: marketing_test.id,
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: "East US",
    managedEnvironmentId: marketing_test.id,
    resourceGroupName: "marketing-stack-eus2-rg",
    template: {
        containers: [{
            env: [
                {
                    name: "MAUTIC_WEB_URL",
                    value: "http://mautic-test-web:9000",
                },
                {
                    name: "MAUTIC_SERVER_NAME",
                    value: "mautic-test",
                },
            ],
            image: "marketingcr.azurecr.io/marketing-nginx:latest",
            name: "mautic-test",
            resources: {
                cpu: 0.75,
                memory: "1.5Gi",
            },
            volumeMounts: [
                {
                    mountPath: "/opt/mautic/cron",
                    volumeName: "cron",
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
                    mountPath: "/var/www/html/config",
                    volumeName: "config",
                },
                {
                    mountPath: "/var/www/html/docroot",
                    volumeName: "docroot",
                },
                {
                    mountPath: "/var/www",
                    volumeName: "www",
                },
            ],
        }],
        revisionSuffix: "",
        scale: {
            maxReplicas: 10,
            minReplicas: 1,
        },
        volumes: [
            {
                name: "cron",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "docroot",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "www",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: true,
});

const mautic_cron = new azure_native.app.ContainerApp("mautic-cron", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        maxInactiveRevisions: 100,
        registries: [{
            identity: "",
            passwordSecretRef: "reg-pswd-ef91ee99-b211",
            server: "marketingcr.azurecr.io",
            username: "marketingcr",
        }],
        secrets: [{
            name: "reg-pswd-ef91ee99-b211",
        }],
    },
    containerAppName: "mautic-cron",
    environmentId: "/subscriptions/b20cccb5-66d3-485a-a768-496711f76646/resourceGroups/marketing-stack-eus2-rg/providers/Microsoft.App/managedEnvironments/marketing-test",
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: "East US",
    managedEnvironmentId: marketing_test.id,
    resourceGroupName: "marketing-stack-eus2-rg",
    template: {
        containers: [{
            env: [
                {
                    name: "MAUTIC_ROLE",
                    value: "mautic_cron",
                },
                {
                    name: "APP_ENV",
                    value: "prod",
                },
            ],
            image: "marketingcr.azurecr.io/marketing-mautic_cron:latest",
            name: "mautic-cron",
            resources: {
                cpu: 0.5,
                memory: "1Gi",
            },
            volumeMounts: [
                {
                    mountPath: "/opt/mautic/cron",
                    volumeName: "cron",
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
                    mountPath: "/var/www/html/config",
                    volumeName: "config",
                },
            ],
        }],
        revisionSuffix: "",
        scale: {
            maxReplicas: 1,
            minReplicas: 1,
        },
        volumes: [
            {
                name: "cron",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: true,
});

const mautic_worker = new azure_native.app.ContainerApp("mautic-worker", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        maxInactiveRevisions: 100,
        registries: [{
            identity: "",
            passwordSecretRef: "reg-pswd-3f7155a1-9440",
            server: "marketingcr.azurecr.io",
            username: "marketingcr",
        }],
        secrets: [{
            name: "reg-pswd-3f7155a1-9440",
        }],
    },
    containerAppName: "mautic-worker",
    environmentId: "/subscriptions/b20cccb5-66d3-485a-a768-496711f76646/resourceGroups/marketing-stack-eus2-rg/providers/Microsoft.App/managedEnvironments/marketing-test",
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: "East US",
    managedEnvironmentId: marketing_test.id,
    resourceGroupName: "marketing-stack-eus2-rg",
    template: {
        containers: [{
            env: [
                {
                    name: "MAUTIC_ROLE",
                    value: "mautic_worker",
                },
                {
                    name: "DB_USER",
                    value: "mauticuser",
                },
                {
                    name: "DB_HOST",
                    value: "marketing-mysql.mysql.database.azure.com",
                },
                {
                    name: "DB_PORT",
                    value: "3306",
                },
                {
                    name: "DB_NAME",
                    value: "mauticdb",
                },
                {
                    name: "DB_PASSWORD",
                    value: "Mauticpassword",
                },
                {
                    name: "APP_SECRET",
                    value: "05476580bb6fb6d44fe4471587fa733b1f0ea1a48ad95bd8f677fbec7cb311fbPS",
                },
                {
                    name: "SITE_URL",
                    value: "mautic-test.delightfulocean-116a429f.eastus.azurecontainerapps.io/",
                },
                {
                    name: "APP_DEBUG",
                    value: "0",
                },
                {
                    name: "MAUTIC_MESSENGER_DSN_EMAIL",
                    value: "doctrine://default",
                },
                {
                    name: "MAUTIC_MESSENGER_DSN_HIT",
                    value: "doctrine://default",
                },
                {
                    name: "MAUTIC_MESSENGER_DSN_FAILED",
                    value: "doctrine://default",
                },
            ],
            image: "marketingcr.azurecr.io/marketing-mautic_worker:latest",
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
            minReplicas: 1,
        },
        volumes: [
            {
                name: "cron",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "docroot",
                storageName: "mautic-app-files",
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: true,
});

const marketingcr = new azure_native.containerregistry.Registry("marketingcr", {
    adminUserEnabled: true,
    dataEndpointEnabled: false,
    encryption: {
        status: azure_native.containerregistry.EncryptionStatus.Disabled,
    },
    location: "eastus2",
    networkRuleBypassOptions: azure_native.containerregistry.NetworkRuleBypassOptions.AzureServices,
    policies: {
        exportPolicy: {
            status: azure_native.containerregistry.ExportPolicyStatus.Enabled,
        },
        quarantinePolicy: {
            status: azure_native.containerregistry.PolicyStatus.Disabled,
        },
        retentionPolicy: {
            days: 7,
            status: azure_native.containerregistry.PolicyStatus.Disabled,
        },
        trustPolicy: {
            status: azure_native.containerregistry.PolicyStatus.Disabled,
            type: azure_native.containerregistry.TrustPolicyType.Notary,
        },
    },
    publicNetworkAccess: azure_native.containerregistry.PublicNetworkAccess.Enabled,
    registryName: "marketingcr",
    resourceGroupName: "marketing-stack-eus2-rg",
    sku: {
        name: azure_native.containerregistry.SkuName.Standard,
    },
    tags: {
        environment: "marketing-stack-rg",
    },
    zoneRedundancy: azure_native.containerregistry.ZoneRedundancy.Disabled,
}, {
    protect: true,
});

const marketing_mysql = new azure_native.dbformysql.Server("marketing-mysql", {
    administratorLogin: "adminuser",
    availabilityZone: "2",
    backup: {
        backupRetentionDays: 7,
        geoRedundantBackup: azure_native.dbformysql.EnableStatusEnum.Disabled,
    },
    highAvailability: {
        mode: azure_native.dbformysql.HighAvailabilityMode.Disabled,
        standbyAvailabilityZone: "",
    },
    location: "East US 2",
    maintenanceWindow: {
        customWindow: "Disabled",
        dayOfWeek: 0,
        startHour: 0,
        startMinute: 0,
    },
    replicationRole: azure_native.dbformysql.ReplicationRole.None,
    resourceGroupName: "marketing-stack-eus2-rg",
    serverName: "marketing-mysql",
    sku: {
        name: "Standard_B1ms",
        tier: azure_native.dbformysql.SkuTier.Burstable,
    },
    storage: {
        autoGrow: azure_native.dbformysql.EnableStatusEnum.Enabled,
        autoIoScaling: azure_native.dbformysql.EnableStatusEnum.Disabled,
        iops: 396,
        logOnDisk: azure_native.dbformysql.EnableStatusEnum.Disabled,
        storageSizeGB: 32,
    },
    version: azure_native.dbformysql.ServerVersion.ServerVersion_8_0_21,
}, {
    protect: true,
});