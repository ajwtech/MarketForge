import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";


const config = new pulumi.Config();
const location = config.require("location");
const resourceGroupName = ResourceGroup.name;
const logAnalyticsWorkspaceId = config.require("logAnalyticsWorkspaceId");

export const logAnalyticsWorkspace = new azure_native.operationalinsights.v20230901.Workspace(logAnalyticsWorkspaceId, {
    location: location,
    resourceGroupName: resourceGroupName,
    sku: {
        name: "PerGB2018",
    },
    retentionInDays: 30

});