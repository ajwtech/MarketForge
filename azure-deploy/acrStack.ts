// ACR and Resource Group stack

import { ResourceGroup } from "./infrastructure/resourceGroup";
import { marketingcr } from "./infrastructure/registries/acrRegistry";
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";


export async function returnOutputs() {
    const acrCredentials = pulumi.all([marketingcr.name, ResourceGroup.name]).apply(
        ([registryName, resourceGroupName]) => 
            azure_native.containerregistry.listRegistryCredentials({
                registryName: registryName,
                resourceGroupName: resourceGroupName,
            })
    );
    
    const acrUsernameOut = acrCredentials.username?.apply(user => user || "");
    const acrPasswordOut = acrCredentials.passwords?.apply(pwds => pwds?.values().next() || "");
    const registryUrlOut = marketingcr.loginServer;
    const resourceGroupName = ResourceGroup.name;

    return {
        acrUsernameOut,
        acrPasswordOut,
        registryUrlOut,
        resourceGroupName,
    };
}
