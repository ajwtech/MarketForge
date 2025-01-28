import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";

const config = new pulumi.Config();
const vnetName = config.get("vnetName") || "marketing-vnet";
const vnetAddressPrefixes = config.getObject<string[]>("vnetAddressPrefixes") || ["10.0.0.0/16"];

export const vnet = new azure_native.network.VirtualNetwork(vnetName, {
    resourceGroupName: ResourceGroup.name, // Updated reference
    location: ResourceGroup.location,
    addressSpace: {
        addressPrefixes: vnetAddressPrefixes,
    },
});