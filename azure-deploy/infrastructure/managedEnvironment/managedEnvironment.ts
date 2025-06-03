import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { subnet } from "../networking/subnet";

const config = new pulumi.Config();
const resourceGroupName = config.require("resourceGroupName");
const location = config.require("location");

// Use StackReference to get Log Analytics outputs from acrStack
const acrStack = new pulumi.StackReference("ajwtech/scouten/acrStack");
const logAnalyticsCustomerId = acrStack.getOutput("logAnalyticsCustomerId");
const logAnalyticsSharedKey = acrStack.getOutput("logAnalyticsSharedKey");

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
            customerId: logAnalyticsCustomerId,
            sharedKey: logAnalyticsSharedKey,
            dynamicJsonColumns: true,
        },
    },
    zoneRedundant: false,
}, {
    protect: false,
});

