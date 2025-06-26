import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import * as cloudflare from "@pulumi/cloudflare";

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
    // Container Apps handle domain binding through their customDomains configuration
    // We only need to create the managed certificates here
    
    // Create Managed Certificates that will be automatically bound to the custom domains
    const cmsCert = new azure_app.ManagedCertificate("cmsCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `mc-${args.environmentName}-${cmsSubdomain}-${domain.replace(/\./g, '-')}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${cmsSubdomain}.${domain}`,
        },
    }, { 
        dependsOn: [args.asuidCmsRecords, args.cnameCmsEntries],
        customTimeouts: { create: "30m", update: "15m", delete: "5m" }
    });

    const mapCert = new azure_app.ManagedCertificate("mapCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `mc-${args.environmentName}-${mapSubdomain}-${domain.replace(/\./g, '-')}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${mapSubdomain}.${domain}`,
        },
    }, { 
        dependsOn: [args.asuidMapRecords, args.cnameMapEntries],
        customTimeouts: { create: "30m", update: "15m", delete: "5m" }
    });

    const crmCert = new azure_app.ManagedCertificate("crmCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `mc-${args.environmentName}-${crmSubdomain}-${domain.replace(/\./g, '-')}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${crmSubdomain}.${domain}`,
        },
    }, { 
        dependsOn: [args.asuidCrmRecords, args.cnameCrmEntries],
        customTimeouts: { create: "30m", update: "15m", delete: "5m" }
    });

    return [
        { cert: crmCert },
        { cert: cmsCert },
        { cert: mapCert },
    ];
}