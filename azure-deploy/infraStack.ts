// Infrastructure stack (storage, managed env, DB, etc.)
import { storageAccountKey, mauticAppFilesStorage, suiteCrmAppFilesStorage, strapiAppFilesStorage, jumpboxFilesStorage } from "./infrastructure/storage/storageAccount";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment";
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import * as pulumi from "@pulumi/pulumi";

// Reference the resource group from the ACR infra stack
const acrInfraStack = new pulumi.StackReference("marketforge/setup-acr-infra");

export const resourceGroup = acrInfraStack.getOutput("resourceGroup");

export {
    storageAccountKey,
    mauticAppFilesStorage,
    suiteCrmAppFilesStorage,
    strapiAppFilesStorage,
    jumpboxFilesStorage,
    marketing_env,
    marketing_mysql
};
