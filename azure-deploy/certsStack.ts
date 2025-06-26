import * as pulumi from "@pulumi/pulumi";
import { BindCerts } from "./infrastructure/certificates/nginxCerts";
import { apps, infra } from "./stackRefs";
import * as cloudflare from "@pulumi/cloudflare";



// Get resource names/IDs from outputs
const environmentName = infra.getOutput("marketing_env_name");
const asuidCmsRecords = apps.getOutput("asuidCmsRecords") as pulumi.Output<cloudflare.DnsRecord>;
const asuidCrmRecords = apps.getOutput("asuidCrmRecords") as pulumi.Output<cloudflare.DnsRecord>;
const asuidMapRecords = apps.getOutput("asuidMapRecords") as pulumi.Output<cloudflare.DnsRecord>;
const cnameCmsEntries = apps.getOutput("cnameCmsEntries") as pulumi.Output<cloudflare.DnsRecord>;
const cnameCrmEntries = apps.getOutput("cnameCrmEntries") as pulumi.Output<cloudflare.DnsRecord>;
const cnameMapEntries = apps.getOutput("cnameMapEntries") as pulumi.Output<cloudflare.DnsRecord>;

const certs = BindCerts({
    environmentName,
    asuidCmsRecords,
    asuidCrmRecords,
    asuidMapRecords,
    cnameCmsEntries,
    cnameCrmEntries,
    cnameMapEntries,
});

export function returnOutputs() {
    return {};
}
