// ACR and Resource Group stack

import { ResourceGroup } from "./infrastructure/resourceGroup";
export { acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry";

export { ResourceGroup }

export const resourceGroupName = ResourceGroup.name;
