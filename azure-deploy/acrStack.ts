// ACR and Resource Group stack

import { ResourceGroup } from "./infrastructure/resourceGroup";
import { acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry";

export async function returnOutputs() {
  // Ensure the resource group is created before accessing its properties
  if (!ResourceGroup) {
    throw new Error("ResourceGroup is not defined. Ensure it is created before accessing its properties.");
  }

  // Ensure acrUsername, acrPassword, and registryUrl are defined
  if (!acrUsername || !acrPassword || !registryUrl) {
    throw new Error("ACR credentials or registry URL are not defined. Ensure they are set correctly.");
  }

  const acrUsernameOut = acrUsername;
  const acrPasswordOut = acrPassword;
  const registryUrlOut = registryUrl;
  const resourceGroupName = ResourceGroup.name;

  return {
    acrUsername: acrUsernameOut,
    acrPassword: acrPasswordOut,
    registryUrl: registryUrlOut,
    resourceGroupName: resourceGroupName,
  };
}

returnOutputs();
