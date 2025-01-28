import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { ResourceGroup } from "../resourceGroup";
import { subnet } from "../networking/subnet";

const config = new pulumi.Config();
const location = config.require("location");
const resourceGroupName = ResourceGroup.name;


// Create Managed Environment
export const marketing_env = new azure_app.ManagedEnvironment("marketing-env", {
    environmentName: "marketing-env",
    location: location,
    resourceGroupName: resourceGroupName,
    vnetConfiguration: {
        infrastructureSubnetId: subnet.id,
        internal: false,
        
    },
    zoneRedundant: false,
}, {
    protect: false,
});