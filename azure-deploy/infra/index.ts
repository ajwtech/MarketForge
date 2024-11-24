import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import * as azure from "@pulumi/azure-native";
import * as docker from "@pulumi/docker";

const config = new pulumi.Config();
const location = config.require("location");


const resourceGroupName = config.require("resourceGroupName");
const ResourceGroup = new azure_native.resources.ResourceGroup(resourceGroupName, {
    location: location,
    resourceGroupName: config.require("resourceGroupName"), // Ensure this is set in config
}, {
    protect: false,
});




type ACRSkuTier = keyof typeof azure_native.containerregistry.SkuName;
const acrSkuTier = (config.get("acrSkuTier") as  ACRSkuTier) || "Basic";


const vnet = new azure_native.network.VirtualNetwork("marketing-vnet", {
    resourceGroupName: ResourceGroup.name, // Updated reference
    location: ResourceGroup.location,
    addressSpace: {
        addressPrefixes: ["10.0.0.0/16"],
    },
});

const subnet = new azure_native.network.Subnet("marketing-subnet", {
    resourceGroupName: ResourceGroup.name, // Updated reference
    virtualNetworkName: vnet.name,
    addressPrefix: "10.0.0.0/23", // Updated to /23
});

const storageAccountName = config.require("storageAccountName");

// Update the StorageAccount resource to use the configurable storageAccountName
const ipAddressOrRange = config.get("ipAddressOrRange");

const marketingstackstorage = new azure_native.storage.StorageAccount("marketingstackstorage", {
    accessTier: azure_native.storage.AccessTier.Hot,
    accountName: storageAccountName, // Use config value
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
    location: location,
    minimumTlsVersion: azure_native.storage.MinimumTlsVersion.TLS1_2,
    networkRuleSet: {
        bypass: azure_native.storage.Bypass.AzureServices,
        defaultAction: azure_native.storage.DefaultAction.Allow,
        ipRules: ipAddressOrRange ? [{
            action: azure_native.storage.Action.Allow,
            iPAddressOrRange: ipAddressOrRange,
        }] : [],
    },
    publicNetworkAccess: azure_native.storage.PublicNetworkAccess.Enabled,
    resourceGroupName: ResourceGroup.name, 
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
    protect: false,
});

// Retrieve the storage account key
const storageAccountKeys = marketingstackstorage.name.apply(accountName =>
    azure_native.storage.listStorageAccountKeys({
        accountName: accountName,
        resourceGroupName: resourceGroupName,
    })
);

const storageAccountKey = storageAccountKeys.apply(keys => keys.keys[0].value);

const mauticAppFilesStorage = new azure_native.storage.FileShare("mautic-app-files", {
    accountName: marketingstackstorage.name,
    resourceGroupName: ResourceGroup.name,
    shareName: "mautic-app-files",
});

// Create a Log Analytics workspace
const logAnalyticsWorkspace = new azure.operationalinsights.Workspace("logAnalyticsWorkspace", {
    resourceGroupName: ResourceGroup.name, 
    location: location,
    sku: {
        name: "PerGB2018",
    },
    retentionInDays: 30,
    workspaceCapping: {
        dailyQuotaGb: -1,
    },
});

// Retrieve the Log Analytics shared key
const logAnalyticsSharedKey = pulumi.all([resourceGroupName, logAnalyticsWorkspace.name]).apply(([rgName, workspaceName]) =>
    azure.operationalinsights.getSharedKeys({
        resourceGroupName: rgName,
        workspaceName: workspaceName,
    }).then(keys => keys.primarySharedKey)
);

// Export the Log Analytics workspace ID
export const logAnalyticsWorkspaceId = logAnalyticsWorkspace.id;

const marketing_test = new azure_native.app.ManagedEnvironment("marketing-test", {
    appLogsConfiguration: {
        destination: "log-analytics",
        logAnalyticsConfiguration: {
            customerId: logAnalyticsWorkspace.customerId.apply(id => id || ""),
            sharedKey: logAnalyticsSharedKey.apply(key => key || ""),
        },
    },
    environmentName: "marketing-test",
    location: location,
    resourceGroupName: ResourceGroup.name, // Updated reference
    vnetConfiguration: {
        infrastructureSubnetId: subnet.id,
        internal: false,
    },
    zoneRedundant: false,
}, {
    protect: false,
});

// Create storage configuration in the managed environment
const storage = new azure_native.app.ManagedEnvironmentsStorage("mautic-app-files-storage", {
    environmentName: marketing_test.name,
    resourceGroupName: ResourceGroup.name, // Updated reference
    storageName: "mautic-app-files",
    properties: {
        azureFile: {
            accountName: marketingstackstorage.name,
            shareName: mauticAppFilesStorage.name,
            accessMode: "ReadWrite",
            accountKey: storageAccountKey,
        },
    },
});

const marketingcr = new azure_native.containerregistry.Registry("marketingcr", {
    adminUserEnabled: true,
    dataEndpointEnabled: false,
    encryption: {
        status: azure_native.containerregistry.EncryptionStatus.Disabled,
    },
    location: location,
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
    resourceGroupName: ResourceGroup.name, // Updated reference
    sku: {
        name: azure_native.containerregistry.SkuName[acrSkuTier],
    },
    tags: {
        environment: "marketing-stack-rg",
    },
    zoneRedundancy: azure_native.containerregistry.ZoneRedundancy.Disabled,
}, {
    protect: false,
});

// Ensure the ACR is created before building images
const acrCredentials = marketingcr.name.apply(registryName => 
    azure_native.containerregistry.listRegistryCredentials({
        registryName: registryName,
        resourceGroupName: resourceGroupName,
    })
);

const acrUsername = acrCredentials.apply(creds => creds.username || "");
const acrPassword = acrCredentials.apply(creds => (creds.passwords && creds.passwords[0].value) || "");
const registryUrl = marketingcr.loginServer;

const imageTag = "latest"; 

// Build and push placeholder images to ACR
const placeholderImages = ["marketing-mautic_web", "marketing-nginx", "marketing-mautic_init", "marketing-mautic_cron", "marketing-mautic_worker"];

// Replace forEach with map to collect Image resources
const imageBuilds = placeholderImages.map(imageName => 
    new docker.Image(imageName, {
        imageName: pulumi.interpolate`${registryUrl}/${imageName}:${imageTag}`,
        build: {
            context: ".", 
            dockerfile: `Dockerfile`,
        },
        registry: {
            server: registryUrl,
            username: acrUsername,
            password: acrPassword,
        },
    }, { 
        dependsOn: [marketingcr],
        ignoreChanges: ["build"], // Prevent pushing if the image is already present
    })
);

// Define a dependency for ContainerApps to wait for Docker images

const mautic_test_web = new azure_native.app.ContainerApp("mautic-test-web", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        ingress: {
            external: false,
            targetPort: 9000,
            traffic: [{
                latestRevision: true,
                weight: 100,
            }],
            transport: "Tcp", // Changed from "Tcp" to "Http"
        },
        maxInactiveRevisions: 100,
        registries: [{
            identity: "",
            passwordSecretRef: "registry-password",
            server: marketingcr.loginServer.apply(server => server || ""),
            username: acrUsername,
        }],
        secrets: [{
            name: "acr-password",
            value: acrPassword,
        },
        {
            name: "registry-password",
            value: acrPassword, // Use the retrieved registry password
        }],
    },
    containerAppName: "mautic-test-web",
    environmentId: marketing_test.id,
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: location,
    managedEnvironmentId: marketing_test.id,
    resourceGroupName: ResourceGroup.name,
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
                {
                    name: "STORAGE_ACCOUNT_KEY",
                    value: storageAccountKey,
                },
                {
                    name: "STORAGE_ACCOUNT_NAME",
                    value: storageAccountName, // Use config value
                },
            ],
            image: imageBuilds[0].imageName, // Use the built image
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
            image: pulumi.interpolate`${registryUrl}/marketing-mautic_init:${imageTag}`,
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
            maxReplicas: 10, // Ensure maxReplicas > 0
            minReplicas: 0, // changed from 1 to 0
            rules: [{
                name: "tcp-scaler", // Updated scaler name
                tcp: { // Changed from "tcp" to "http"
                    metadata: {
                        concurrentRequests: "100", // Example metric
                    },
                },
            }],
        },
        volumes: [
            {
                name: "cron",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "docroot",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "datastore",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: false,
    dependsOn: [storage, ...imageBuilds],
});

const mautic_test = new azure_native.app.ContainerApp("mautic-test", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        ingress: {
            allowInsecure: true,
            clientCertificateMode: "Ignore",
            external: true,
            targetPort: 80,
            traffic: [{
                latestRevision: true, 
                weight: 100,
            }],
            transport: "Http", // Changed from "Tcp" to "Http"
        },
        maxInactiveRevisions: 100,
        registries: [{
            identity: "",
            passwordSecretRef: "registry-password",
            server: marketingcr.loginServer.apply(server => server || ""),
            username: acrUsername,
        }],
        secrets: [{
            name: "acr-password",
            value: acrPassword,
        },
        {
            name: "registry-password",
            value: acrPassword, // Use the retrieved registry password
        }],
    },
    containerAppName: "mautic-test",
    environmentId: marketing_test.id,
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: location,
    managedEnvironmentId: marketing_test.id,
    resourceGroupName: ResourceGroup.name,
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
            image: imageBuilds[1].imageName, // Use the built image
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
            maxReplicas: 10, // Ensure maxReplicas > 0
            minReplicas: 0,
            rules: [{
                name: "http-scaler", // Updated scaler name
                http: { // Changed from "tcp" to "http"
                    metadata: {
                        concurrentRequests: "100", // Example metric
                    },
                },
            }],
        },
        volumes: [
            {
                name: "cron",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "docroot",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "www",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: false,
    dependsOn: [storage, ...imageBuilds],
});

const mautic_cron = new azure_native.app.ContainerApp("mautic-cron", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        maxInactiveRevisions: 100,
        registries: [{
            identity: "",
            passwordSecretRef: "registry-password",
            server: "marketingcr.azurecr.io",
            username: "marketingcr",
        }],
        secrets: [{
            name: "registry-password",
            value: acrPassword, // Use the retrieved registry password
        }],
    },
    containerAppName: "mautic-cron",
    environmentId: marketing_test.id,
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: location,
    managedEnvironmentId: marketing_test.id,
    resourceGroupName: ResourceGroup.name,
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
                {
                    name: "STORAGE_ACCOUNT_NAME",
                    value: storageAccountName, // Use config value
                },
                {
                    name: "STORAGE_ACCOUNT_KEY",
                    value: storageAccountKey, // Use secret from config
                },
            ],
            image: imageBuilds[2].imageName, // Use the built image
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
            maxReplicas: 1, // Ensure maxReplicas > 0
            minReplicas: 0,
            rules: [{
                name: "http-scaler", // Updated scaler name
                http: { // Changed from "tcp" to "http" if applicable
                    metadata: {
                        concurrentRequests: "100", // Example metric
                    },
                },
            }],
        },
        volumes: [
            {
                name: "cron",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: false,
    dependsOn: [storage, ...imageBuilds],
});

const mautic_worker = new azure_native.app.ContainerApp("mautic-worker", {
    configuration: {
        activeRevisionsMode: azure_native.app.ActiveRevisionsMode.Single,
        maxInactiveRevisions: 100,
        registries: [{
            identity: "",
            passwordSecretRef: "registry-password",
            server: "marketingcr.azurecr.io",
            username: "marketingcr",
        }],
        secrets: [{
            name: "registry-password",
            value: acrPassword, // Use the retrieved registry password
        }],
    },
    containerAppName: "mautic-worker",
    environmentId: marketing_test.id,
    identity: {
        type: azure_native.app.ManagedServiceIdentityType.None,
    },
    location: location,
    managedEnvironmentId: marketing_test.id,
    resourceGroupName: ResourceGroup.name,
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
                {
                    name: "STORAGE_ACCOUNT_NAME",
                    value: storageAccountName, // Use config value
                },
                {
                    name: "STORAGE_ACCOUNT_KEY",
                    value: storageAccountKey, // Use secret from config
                },
            ],
            image: imageBuilds[3].imageName, // Use the built image
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
            maxReplicas: 1, // Ensure maxReplicas > 0
            minReplicas: 0,
            rules: [{
                name: "http-scaler", // Updated scaler name
                http: { // Changed from "tcp" to "http" if applicable
                    metadata: {
                        concurrentRequests: "100", // Example metric
                    },
                },
            }],
        },
        volumes: [
            {
                name: "cron",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "config",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "logs",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "files",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "images",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
            {
                name: "docroot",
                storageName: mauticAppFilesStorage.name,
                storageType: azure_native.app.StorageType.AzureFile,
            },
        ],
    },
}, {
    protect: false,
    dependsOn: [storage, ...imageBuilds],
});

// Retrieve MySQL administrator password from config
const mysqlPassword = config.requireSecret("mysqlAdminPassword");

const marketing_mysql = new azure_native.dbformysql.Server("marketing-mysql", {
    administratorLogin: "adminuser",
    administratorLoginPassword: mysqlPassword,
    availabilityZone: "2",
    backup: {
        backupRetentionDays: 7,
        geoRedundantBackup: azure_native.dbformysql.EnableStatusEnum.Disabled,
    },
    highAvailability: {
        mode: azure_native.dbformysql.HighAvailabilityMode.Disabled,
        standbyAvailabilityZone: "",
    },
    location: location, // Use the same location as other resources
    maintenanceWindow: {
        customWindow: "Disabled",
        dayOfWeek: 0,
        startHour: 0,
        startMinute: 0,
    },
    replicationRole: azure_native.dbformysql.ReplicationRole.None,
    resourceGroupName: ResourceGroup.name, // Changed from 'resourceGroupName' variable to 'ResourceGroup.name'
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
    protect: false,
});