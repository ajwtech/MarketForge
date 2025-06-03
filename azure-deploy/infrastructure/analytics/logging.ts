import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";

// Refactored: Accept resourceGroupName as parameter
export function createLogAnalyticsWorkspace(resourceGroupName: pulumi.Input<string>) {
    const config = new pulumi.Config();
    const location = config.require("location");
    const logAnalyticsWorkspaceId = config.require("logAnalyticsWorkspaceId");

    const logAnalyticsWorkspace = new azure_native.operationalinsights.v20230901.Workspace(logAnalyticsWorkspaceId, {
        location: location,
        resourceGroupName: resourceGroupName,
        sku: {
            name: "PerGB2018",
        },
        retentionInDays: 30
    });

    return { logAnalyticsWorkspace };
}