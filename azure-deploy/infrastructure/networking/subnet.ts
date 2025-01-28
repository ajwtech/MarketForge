
import * as pulumi from "@pulumi/pulumi";
import * as azure_native from "@pulumi/azure-native";
import { ResourceGroup } from "../resourceGroup";
import { vnet } from "./vnet";

const config = new pulumi.Config();
const subnetName = config.get("subnetName") || "marketing-subnet";
const subnetAddressPrefix = config.get("subnetAddressPrefix") || "10.0.0.0/23";
const mysqlSubnetName = config.get("mysqlSubnetName") || "mysql-subnet";
const mysqlSubnetAddressPrefix = config.get("mysqlSubnetAddressPrefix") || "10.0.2.0/24";


export const subnet = new azure_native.network.Subnet(subnetName, {
    resourceGroupName: ResourceGroup.name,
    virtualNetworkName: vnet.name,
    addressPrefix: subnetAddressPrefix,
    delegations: [
        //no delegations for a containerapp subnet
    ],
});

export const mysqlSubnet  = new azure_native.network.Subnet(mysqlSubnetName, {
    resourceGroupName: ResourceGroup.name,
    virtualNetworkName: vnet.name,
    addressPrefix: mysqlSubnetAddressPrefix,
    delegations: [
        {
            name: "Microsoft.DBforMySQL/flexibleServers",
            serviceName: "Microsoft.DBforMySQL/flexibleServers",
        }
    ],
});