// Infrastructure stack (storage, managed env, DB, etc.)
import { storageAccountKey, mauticAppFilesStorage, suiteCrmAppFilesStorage, strapiAppFilesStorage, jumpboxFilesStorage } from "./infrastructure/storage/storageAccount";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment";
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();
// Helper to get org/project from ENV_ESC and build fully qualified stack names
function getStackRefName(stackNameConfigKey: string): string {
    const envEsc = process.env.ENV_ESC;
    if (!envEsc) {
        throw new Error("ENV_ESC environment variable is required");
    }
    const orgProject = envEsc.slice(0, envEsc.lastIndexOf("/"));
    const stack = config.require(stackNameConfigKey);
    return `${orgProject}/${stack}`;
}

// Reference the resource group from the ACR infra stack
const acrInfraStack = new pulumi.StackReference(getStackRefName("acrStack"));

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
