// ACR and Resource Group stack

import { ResourceGroup } from "./infrastructure/resourceGroup";
import { acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry";

export const acrUsernameOut = acrUsername;
export const acrPasswordOut = acrPassword;
export const registryUrlOut = registryUrl;


export const resourceGroupName = ResourceGroup.name;
