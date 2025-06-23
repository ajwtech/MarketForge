import * as pulumi from "@pulumi/pulumi";
import { BindCerts } from "./infrastructure/certificates/nginxCerts";
import { acr, infra } from "./stackRefs";

import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import * as cloudflare from "@pulumi/cloudflare";

// Reference outputs from the apps stack
const config = new pulumi.Config();

// Get resource names/IDs from outputs
const resourceGroupName = config.require("resourceGroupName");
const mauticNginxAppName = infra.getOutput("mauticNginxApp");
const deployedStrapiAppName = infra.getOutput("deployedStrapiApp");
const marketing_env = infra.getOutput("marketing_env");
const asuidCmsRecords = infra.getOutput("asuidCmsRecords");
const asuidCrmRecords = infra.getOutput("asuidCrmRecords");
const asuidMapRecords = infra.getOutput("asuidMapRecords");
const cnameCmsEntries = infra.getOutput("cnameCmsEntries");
const cnameCrmEntries = infra.getOutput("cnameCrmEntries");
const cnameMapEntries = infra.getOutput("cnameMapEntries");

// Re-import the ContainerApp resources using .get
const mauticNginxApp = azure_app.ContainerApp.get("mauticNginxApp", pulumi.interpolate`${resourceGroupName}/${mauticNginxAppName.apply(name => name)}`);
const deployedStrapiApp = azure_app.ContainerApp.get("deployedStrapiApp", pulumi.interpolate`${resourceGroupName}/${deployedStrapiAppName.apply(name => name)}`);

const certs = BindCerts({
    nginxApp: mauticNginxApp,
    strapiApp: deployedStrapiApp,
    environmentName: marketing_env,
    asuidCmsRecords: cloudflare.DnsRecord.get("asuidCmsRecords", asuidCmsRecords.apply(record => record.id)),
    asuidCrmRecords: cloudflare.DnsRecord.get("asuidCrmRecords", asuidCrmRecords.apply(record => record.id)),
    asuidMapRecords: cloudflare.DnsRecord.get("asuidMapRecords", asuidMapRecords.apply(record => record.id)),
    cnameCmsEntries: cloudflare.DnsRecord.get("cnameCmsEntries", cnameCmsEntries.apply(record => record.id)),
    cnameCrmEntries: cloudflare.DnsRecord.get("cnameCrmEntries", cnameCrmEntries.apply(record => record.id)),
    cnameMapEntries: cloudflare.DnsRecord.get("cnameMapEntries", cnameMapEntries.apply(record => record.id)),
});

export function returnOutputs() {
    return {
        certs,
    };
}
