import { getStackRefName } from "../../utils/stackRef";
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";


const config = new pulumi.Config();
const acrInfraStack = new pulumi.StackReference(getStackRefName(config, "setup-acr-infra"));
const resourceGroupName = acrInfraStack.getOutput("resourceGroup").apply((rg: any) => rg.name || rg);
const location = config.require("location");
const logAnalyticsWorkspaceId = config.require("logAnalyticsWorkspaceId");

export const logAnalyticsWorkspace = new azure_native.operationalinsights.v20230901.Workspace(logAnalyticsWorkspaceId, {
    location: location,
    resourceGroupName: resourceGroupName,
    sku: {
        name: "PerGB2018",
    },
    retentionInDays: 30

});