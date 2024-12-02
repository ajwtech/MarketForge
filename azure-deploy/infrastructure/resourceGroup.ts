import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";

const config = new pulumi.Config();
const location = config.require("location");
const resourceGroupName = config.require("resourceGroupName");

export const ResourceGroup = new azure_native.resources.ResourceGroup(resourceGroupName, {
    location: config.require("location"),
    resourceGroupName: config.require("resourceGroupName"),
});