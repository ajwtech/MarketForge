import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";

const config = new pulumi.Config();
const location = config.require("location");

export const logAnalyticsWorkspace = new azure_native.operationalinsights.Workspace("logAnalyticsWorkspace", {
    resourceGroupName: ResourceGroup.name, 
    location: location,
    sku: {
        name: "PerGB2018",
    },
    retentionInDays: 30,
    workspaceCapping: {
        dailyQuotaGb: -1,
    },
}, {
    protect: false,
});