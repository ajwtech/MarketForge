import * as pulumi from "@pulumi/pulumi";
import { BindCerts } from "./infrastructure/certificates/nginxCerts";
import { apps, infra } from "./stackRefs";
import * as cloudflare from "@pulumi/cloudflare";

// Reference outputs from the apps stack
const config = new pulumi.Config();

// Get resource names/IDs from outputs
const resourceGroupName = config.require("resourceGroupName");
const environmentName = infra.getOutput("marketing_env_name");
const asuidCmsRecords = apps.getOutput("asuidCmsRecords") as pulumi.Output<cloudflare.DnsRecord>;
const asuidCrmRecords = apps.getOutput("asuidCrmRecords") as pulumi.Output<cloudflare.DnsRecord>;
const asuidMapRecords = apps.getOutput("asuidMapRecords") as pulumi.Output<cloudflare.DnsRecord>;
const asuidBetaRecords = apps.getOutput("asuidBetaRecords") as pulumi.Output<cloudflare.DnsRecord>;
const cnameCmsEntries = apps.getOutput("cnameCmsEntries") as pulumi.Output<cloudflare.DnsRecord>;
const cnameCrmEntries = apps.getOutput("cnameCrmEntries") as pulumi.Output<cloudflare.DnsRecord>;
const cnameMapEntries = apps.getOutput("cnameMapEntries") as pulumi.Output<cloudflare.DnsRecord>;
const cnameBetaEntries = apps.getOutput("cnameBetaEntries") as pulumi.Output<cloudflare.DnsRecord>;

const certs = BindCerts({
    environmentName,
    asuidCmsRecords,
    asuidCrmRecords,
    asuidMapRecords,
    asuidBetaRecords,
    cnameCmsEntries,
    cnameCrmEntries,
    cnameMapEntries,
    cnameBetaEntries,
});

export function returnOutputs() {
    return {};
}
