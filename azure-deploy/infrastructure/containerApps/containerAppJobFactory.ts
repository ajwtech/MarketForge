import * as pulumi from "@pulumi/pulumi";
import * as azureNative from "@pulumi/azure-native";

const config = new pulumi.Config();
const jobName = config.require("jobName");
const location = config.require("location");
const environmentId = config.require("environmentId");
const resourceGroupName = config.require("resourceGroupName");
const containers = config.getObject<any>("containers");
const registries = config.getObject<any>("registries") || [];
const secrets = config.getObject<any>("secrets") || { arrayValue: [] };

const containerAppJob = new azureNative.app.Job(jobName, {
    resourceGroupName,
    location,
    environmentId,
    configuration: {
        registries,
        secrets: secrets.arrayValue,
        triggerType: azureNative.app.TriggerType.Schedule,
        replicaTimeout: 60,
    },
    template: {
        containers,
    }
}, {
});

export { containerAppJob };
