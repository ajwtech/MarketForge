
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";
import { subnet } from "../networking/subnet";
import { logAnalyticsWorkspace } from "../logAnalytics/workspace"; 

const config = new pulumi.Config();
const location = config.require("location");
const resourceGroupName = ResourceGroup.name;

// Retrieve the Log Analytics shared key
const logAnalyticsSharedKey = pulumi.all([resourceGroupName, logAnalyticsWorkspace.name]).apply(([rgName, workspaceName]) =>
    azure_native.operationalinsights.getSharedKeys({
        resourceGroupName: rgName,
        workspaceName: workspaceName,
    }).then(keys => keys.primarySharedKey)
);

// Create Managed Environment
export const marketing_env = new azure_native.app.ManagedEnvironment("marketing-env", {
    appLogsConfiguration: {
        destination: "log-analytics",
        logAnalyticsConfiguration: {
            customerId: logAnalyticsWorkspace.customerId.apply(id => id || ""),
            sharedKey: logAnalyticsSharedKey.apply(key => key || ""),
        },
    },
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