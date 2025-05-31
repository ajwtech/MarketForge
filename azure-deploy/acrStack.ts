// ACR and Resource Group stack

import { ResourceGroup } from "./infrastructure/resourceGroup";
import { marketingcr } from "./infrastructure/registries/acrRegistry";
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";


export async function returnOutputs() {
    const acrCredentials = marketingcr.name.apply(registryName =>
        ResourceGroup.name.apply(resourceGroupName =>
            azure_native.containerregistry.listRegistryCredentials({
                registryName,
                resourceGroupName,
            })
        )
    );
    
    const acrUsernameOut = acrCredentials.username?.apply(user => user || "");
    // Fix: Export only the password string, not the object
    const acrPasswordOut = acrCredentials.passwords?.apply(pwds => {
        if (Array.isArray(pwds) && pwds.length > 0 && pwds[0].value) {
            return pwds[0].value;
        }
        // fallback for object/Map
        if (pwds && typeof pwds === 'object') {
            const first = Object.values(pwds)[0];
            if (first && first.value) {
                return first.value;
            }
        }
        return "";
    });
    const registryUrlOut = marketingcr.loginServer;
    const resourceGroupName = ResourceGroup.name;

    return {
        acrUsernameOut,
        acrPasswordOut, // Now a string, not an object
        registryUrlOut,
        resourceGroupName,
    };
}
