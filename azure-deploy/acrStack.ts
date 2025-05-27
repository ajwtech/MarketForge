// ACR and Resource Group stack

import { ResourceGroup } from "./infrastructure/resourceGroup";
import { marketingcr } from "./infrastructure/registries/acrRegistry";
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";


const acrCredentials = pulumi.all([marketingcr.name, ResourceGroup.name]).apply(
    ([registryName, resourceGroupName]) => 
        azure_native.containerregistry.listRegistryCredentials({
            registryName: registryName,
            resourceGroupName: resourceGroupName,
        })
);
export const acrUsername = acrCredentials.username?.apply(user => user || "");
export const acrPassword = acrCredentials.passwords?.apply(pwds => pwds?.values().next() || "");
export const registryUrl = marketingcr.loginServer;
export const resourceGroupName = ResourceGroup.name;

