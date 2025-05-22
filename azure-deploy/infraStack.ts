

// Infrastructure stack (storage, managed env, DB, etc.)
import { storageAccountKey, mauticAppFilesStorage, suiteCrmAppFilesStorage, strapiAppFilesStorage, jumpboxFilesStorage } from "./infrastructure/storage/storageAccount";
import { marketing_env } from "./infrastructure/managedEnvironment/managedEnvironment";
import { marketing_mysql } from "./infrastructure/database/mysqlServer";
import { ResourceGroup } from "./infrastructure/resourceGroup";

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
