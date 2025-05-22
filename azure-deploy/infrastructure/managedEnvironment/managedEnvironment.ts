import { getStackRefName } from "../../utils/stackRef";
import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { subnet } from "../networking/subnet";
import { logAnalyticsWorkspace } from "../analytics/logging";
import * as azure_native from "@pulumi/azure-native";

const config = new pulumi.Config();
const acrInfraStack = new pulumi.StackReference(getStackRefName(config, "setup-acr-infra"));
const resourceGroupName = acrInfraStack.getOutput("resourceGroup").apply((rg: any) => rg.name || rg);
const location = config.require("location");
const sharedKey = pulumi
    .all([logAnalyticsWorkspace.name, resourceGroupName])
    .apply(([workspaceName, resourceGroupName]) =>
        azure_native.operationalinsights.getWorkspaceSharedKeys({
            workspaceName: workspaceName,
            resourceGroupName: resourceGroupName,
        }).then(keys => keys.primarySharedKey ?? "")
    );

// Create Managed Environment
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

