import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { subnet } from "../networking/subnet";
import { acr } from "../../stackRefs";

const config = new pulumi.Config();
const location = config.require("location");

// Use StackReference to get Log Analytics outputs from acrStack
const resourceGroupName = acr.getOutput("resourceGroupName")
const logAnalyticsWorkspaceId = acr.getOutput("logAnalyticsWorkspaceId");
const logAnalyticsSharedKey = acr.getOutput("logAnalyticsSharedKey");

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
            customerId: logAnalyticsWorkspaceId,
            sharedKey: logAnalyticsSharedKey,
            dynamicJsonColumns: true,
        },
    },
    zoneRedundant: false,
}, {
    protect: false,
});

