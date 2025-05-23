// ACR and Resource Group stack
import { acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry";
import { ResourceGroup } from "./infrastructure/resourceGroup";

// Export stack outputs for cross-stack reference
export {
  acrUsername as acrUsernameOut,
  acrPassword as acrPasswordOut,
  registryUrl as registryUrlOut,
  ResourceGroup
};

export const resourceGroupName = ResourceGroup.name;
