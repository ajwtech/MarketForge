import * as pulumi from "@pulumi/pulumi";
import { BindCerts } from "./infrastructure/certificates/nginxCerts";
import { apps, infra } from "./stackRefs";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import * as cloudflare from "@pulumi/cloudflare";

// Reference outputs from the apps stack
const config = new pulumi.Config();

// Get resource names/IDs from outputs
const resourceGroupName = config.require("resourceGroupName");
const nginxApp = apps.getOutput("mauticNginxApp") as pulumi.Output<azure_app.ContainerApp>;
const strapiApp = apps.getOutput("deployedStrapiApp") as pulumi.Output<azure_app.ContainerApp>;
const environmentName = infra.getOutput("marketing_env_name");
const asuidCmsRecords = apps.getOutput("asuidCmsRecords") as pulumi.Output<cloudflare.DnsRecord>;
const asuidCrmRecords = apps.getOutput("asuidCrmRecords") as pulumi.Output<cloudflare.DnsRecord>;
const asuidMapRecords = apps.getOutput("asuidMapRecords") as pulumi.Output<cloudflare.DnsRecord>;
const cnameCmsEntries = apps.getOutput("cnameCmsEntries") as pulumi.Output<cloudflare.DnsRecord>;
const cnameCrmEntries = apps.getOutput("cnameCrmEntries") as pulumi.Output<cloudflare.DnsRecord>;
const cnameMapEntries = apps.getOutput("cnameMapEntries") as pulumi.Output<cloudflare.DnsRecord>;

const certs = BindCerts({
    nginxApp,
    strapiApp,
    environmentName,
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
