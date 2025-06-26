import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import * as command from "@pulumi/command";
import * as cloudflare from "@pulumi/cloudflare";
import { apps } from "../../stackRefs";

const config = new pulumi.Config();
const resourceGroupName = config.require("resourceGroupName");
const domain = config.require("domain");
const mapSubdomain = config.get("mapSubdomain") || "map";
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const crmSubdomain = config.get("crmSubdomain") || "crm";

export interface BindCertsArgs {
    environmentName: pulumi.Input<string>;
    asuidCmsRecords: pulumi.Output<cloudflare.DnsRecord>;
    asuidCrmRecords: pulumi.Output<cloudflare.DnsRecord>;
    asuidMapRecords: pulumi.Output<cloudflare.DnsRecord>;
    cnameCmsEntries: pulumi.Output<cloudflare.DnsRecord>;
    cnameCrmEntries: pulumi.Output<cloudflare.DnsRecord>;
    cnameMapEntries: pulumi.Output<cloudflare.DnsRecord>;
}

export function BindCerts(args: BindCertsArgs) {
    // Get Container App names from stack references
    const strapiAppName = apps.getOutput("deployedStrapiApp").apply(app => app.name);
    const nginxAppName = apps.getOutput("mauticNginxApp").apply(app => app.name);
    
    // Use CLI commands to bind domains AND create certificates in one step
    // This approach avoids the certificate ID dependency issue
    const bindCmsCommand = new command.local.Command("bind-cms-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${cmsSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${strapiAppName} \
        --environment ${args.environmentName} \
        --validation-method CNAME \
        --output json || echo "Domain binding may already exist"`,
        triggers: [args.asuidCmsRecords.modifiedOn, args.cnameCmsEntries.modifiedOn],
    }, { 
        dependsOn: [args.asuidCmsRecords, args.cnameCmsEntries],
        customTimeouts: { create: "30m" }
    });

    const bindMapCommand = new command.local.Command("bind-map-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${mapSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${nginxAppName} \
        --environment ${args.environmentName} \
        --validation-method CNAME \
        --output json || echo "Domain binding may already exist"`,
        triggers: [args.asuidMapRecords.modifiedOn, args.cnameMapEntries.modifiedOn],
    }, { 
        dependsOn: [args.asuidMapRecords, args.cnameMapEntries, bindCmsCommand],
        customTimeouts: { create: "30m" }
    });

    const bindCrmCommand = new command.local.Command("bind-crm-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${crmSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${nginxAppName} \
        --environment ${args.environmentName} \
        --validation-method CNAME \
        --output json || echo "Domain binding may already exist"`,
        triggers: [args.asuidCrmRecords.modifiedOn, args.cnameCrmEntries.modifiedOn],
    }, { 
        dependsOn: [args.asuidCrmRecords, args.cnameCrmEntries, bindMapCommand],
        customTimeouts: { create: "30m" }
    });

    return [
        { bindCommand: bindCrmCommand },
        { bindCommand: bindCmsCommand },
        { bindCommand: bindMapCommand },
    ];
}