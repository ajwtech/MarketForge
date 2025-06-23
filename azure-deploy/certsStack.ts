import * as pulumi from "@pulumi/pulumi";
import { BindCerts } from "./infrastructure/certificates/nginxCerts";
import { acr, infra } from "./stackRefs";
import { DnsRecord } from "@pulumi/cloudflare";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";

// Reference outputs from the apps stack
const config = new pulumi.Config();
const project = pulumi.getProject();
const env = pulumi.getStack();

// Get resource names/IDs from outputs
const resourceGroupName = config.require("resourceGroupName");
const mauticNginxAppName = infra.getOutput("mauticNginxAppName");
const deployedStrapiAppName = infra.getOutput("deployedStrapiAppName");
const marketing_env = infra.getOutput("marketing_env");
const asuidCmsRecords = infra.getOutput("asuidCmsRecords") as pulumi.Output<DnsRecord>;
const asuidCrmRecords = infra.getOutput("asuidCrmRecords") as pulumi.Output<DnsRecord>;
const asuidMapRecords = infra.getOutput("asuidMapRecords") as pulumi.Output<DnsRecord>;
const cnameCmsEntries = infra.getOutput("cnameCmsEntries") as pulumi.Output<DnsRecord>;
const cnameCrmEntries = infra.getOutput("cnameCrmEntries") as pulumi.Output<DnsRecord>;
const cnameMapEntries = infra.getOutput("cnameMapEntries") as pulumi.Output<DnsRecord>;

// Re-import the ContainerApp resources using .get
const mauticNginxApp = azure_app.ContainerApp.get("mauticNginxApp", pulumi.interpolate`${resourceGroupName}/${mauticNginxAppName}`);
const deployedStrapiApp = azure_app.ContainerApp.get("deployedStrapiApp", pulumi.interpolate`${resourceGroupName}/${deployedStrapiAppName}`);

const certs = BindCerts({
    nginxApp: mauticNginxApp,
    strapiApp: deployedStrapiApp,
    environmentName: marketing_env,
    asuidCmsRecords,
    asuidCrmRecords,
    asuidMapRecords,
    cnameCmsEntries,
    cnameCrmEntries,
    cnameMapEntries,
});

export function returnOutputs() {
    return {
        certs,
    };
}
