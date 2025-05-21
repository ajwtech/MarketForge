import * as pulumi from "@pulumi/pulumi";
// ACR and Resource Group stack
import { acrUsername, acrPassword, registryUrl } from "./infrastructure/registries/acrRegistry"
import { ResourceGroup } from "./infrastructure/resourceGroup"

// Debug: Print Pulumi config at stack start
  console.log("[acrStack] Pulumi config at stack start:", JSON.stringify(pulumi.runtime.allConfig(), null, 2));




export { acrUsername, acrPassword, registryUrl, ResourceGroup };
