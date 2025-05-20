import * as pulumi from "@pulumi/pulumi";

// Debug: Print Pulumi config at stack start
  console.log("[acrStack] Pulumi config at stack start:", pulumi.runtime.allConfig());


// ACR and Resource Group stack
const { acrUsername, acrPassword, registryUrl } = require("./infrastructure/registries/acrRegistry");
const { ResourceGroup } = require("./infrastructure/resourceGroup");

export { acrUsername, acrPassword, registryUrl, ResourceGroup };
