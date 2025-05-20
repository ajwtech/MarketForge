import * as pulumi from "@pulumi/pulumi";

// Debug: Print Pulumi config at stack start
pulumi.runtime.allConfig().then((cfg: Record<string, pulumi.ConfigValue>) => {
    console.log("[infraStack] Pulumi config at stack start:", cfg);
});

// Infrastructure stack (storage, managed env, DB, etc.)
const {
    storageAccountKey, mauticAppFilesStorage, suiteCrmAppFilesStorage,
    strapiAppFilesStorage, jumpboxFilesStorage
} = require("./infrastructure/storage/storageAccount");
const { marketing_env } = require("./infrastructure/managedEnvironment/managedEnvironment");
const { marketing_mysql } = require("./infrastructure/database/mysqlServer");
const { ResourceGroup } = require("./infrastructure/resourceGroup");

export {
    storageAccountKey,
    mauticAppFilesStorage,
    suiteCrmAppFilesStorage,
    strapiAppFilesStorage,
    jumpboxFilesStorage,
    marketing_env,
    marketing_mysql,
    ResourceGroup
};
