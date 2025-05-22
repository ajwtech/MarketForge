import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";

const config = new pulumi.Config();
const resourceGroupName = config.require("resourceGroupName");
const vnetName = config.get("vnetName") || "marketing-vnet";
const vnetAddressPrefixes = config.getObject<string[]>("vnetAddressPrefixes") || ["10.0.0.0/16"];

export const vnet = new azure_native.network.VirtualNetwork(vnetName, {
    resourceGroupName: resourceGroupName,
    location: config.require("location"),
    addressSpace: {
        addressPrefixes: vnetAddressPrefixes,
    },
});