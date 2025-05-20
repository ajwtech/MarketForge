import * as pulumi from "@pulumi/pulumi";

// ACR and Resource Group stack
const { acrUsername, acrPassword, registryUrl } = require("./infrastructure/registries/acrRegistry");
const { ResourceGroup } = require("./infrastructure/resourceGroup");

export { acrUsername, acrPassword, registryUrl, ResourceGroup };
