import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { subnet } from "../networking/subnet";
import { createLogAnalyticsWorkspace } from "../analytics/logging";
import * as azure_native from "@pulumi/azure-native";

const config = new pulumi.Config();
const resourceGroupName = config.require("resourceGroupName");
const location = config.require("location");

const { logAnalyticsWorkspace } = createLogAnalyticsWorkspace(resourceGroupName);

const sharedKey = logAnalyticsWorkspace.name.apply(workspaceName =>
    azure_native.operationalinsights.getWorkspaceSharedKeys({
        workspaceName,
        resourceGroupName,
    }).then(keys => keys.primarySharedKey ?? "")
);

export const marketing_env = new azure_app.ManagedEnvironment("marketing-env", {
    environmentName: "marketing-env",
    location: location,
    resourceGroupName: resourceGroupName,
    vnetConfiguration: {
        infrastructureSubnetId: subnet.id,
        internal: false,     
    },
    
    appLogsConfiguration: {
        destination: "log-analytics",
        logAnalyticsConfiguration: {
            customerId: logAnalyticsWorkspace.customerId,
            sharedKey: sharedKey,
            dynamicJsonColumns: true,
        },
    },
    zoneRedundant: false,
}, {
    protect: false,
});

