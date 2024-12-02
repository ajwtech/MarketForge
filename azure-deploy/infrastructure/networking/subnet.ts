
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";
import { vnet } from "./vnet";

const config = new pulumi.Config();
const subnetName = config.get("subnetName") || "marketing-subnet";
const subnetAddressPrefix = config.get("subnetAddressPrefix") || "10.0.0.0/23";

export const subnet = new azure_native.network.Subnet(subnetName, {
    resourceGroupName: ResourceGroup.name,
    virtualNetworkName: vnet.name,
    addressPrefix: subnetAddressPrefix,
});