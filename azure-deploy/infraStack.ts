// Infrastructure stack (storage, managed env, DB, etc.)
import { createStorageResources } from "./infrastructure/storage/storageAccount";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment";
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import * as pulumi from "@pulumi/pulumi";
import { getStackRefName } from "./utils/stackRef";

const config = new pulumi.Config();

// Reference the resource group from the ACR infra stack
const acrInfraStack = new pulumi.StackReference(getStackRefName(config, "setup-acr-infra"));

export const resourceGroup = acrInfraStack.getOutput("resourceGroup");

// Use object destructuring for storage resources
const storageResources = createStorageResources(resourceGroup);
const {
    storageAccountKey,
    mauticAppFilesStorage,
    suiteCrmAppFilesStorage,
    strapiAppFilesStorage,
    jumpboxFilesStorage
} = storageResources;

export {
    storageAccountKey,
    mauticAppFilesStorage,
    suiteCrmAppFilesStorage,
    strapiAppFilesStorage,
    jumpboxFilesStorage,
    marketing_env,
    marketing_mysql
};
