import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import * as command from "@pulumi/command";
import * as cloudflare from "@pulumi/cloudflare";


const config = new pulumi.Config();
const resourceGroupName = config.require("resourceGroupName");
const domain = config.require("domain");
const mapSubdomain = config.get("mapSubdomain") || "map";
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const crmSubdomain = config.get("crmSubdomain") || "crm";



export interface BindCertsArgs {
    nginxApp: pulumi.Output<azure_app.ContainerApp>;
    strapiApp: pulumi.Output<azure_app.ContainerApp>;
    environmentName: pulumi.Input<string>;
    asuidCmsRecords: pulumi.Output<cloudflare.DnsRecord>;
    asuidCrmRecords: pulumi.Output<cloudflare.DnsRecord>;
    asuidMapRecords: pulumi.Output<cloudflare.DnsRecord>;
    cnameCmsEntries: pulumi.Output<cloudflare.DnsRecord>;
    cnameCrmEntries: pulumi.Output<cloudflare.DnsRecord>;
    cnameMapEntries: pulumi.Output<cloudflare.DnsRecord>;
}

export function BindCerts(args: BindCertsArgs) {
 // Early return if no asuidDNSEntries provided
    const bindCmsCommand = new command.local.Command("bind-cms-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${cmsSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${args.strapiApp.name} \
        --environment ${args.environmentName} \
        --validation-method CNAME`,
        triggers: [args.strapiApp.systemData.lastModifiedAt, args.asuidCmsRecords.modifiedOn, args.cnameCmsEntries.modifiedOn],
    });

    const bindMapCommand = new command.local.Command("bind-map-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${mapSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${args.nginxApp.name} \
        --environment ${args.environmentName} \
        --validation-method CNAME`,
        triggers: [args.nginxApp.systemData.lastModifiedAt, args.asuidMapRecords.modifiedOn, args.cnameMapEntries.modifiedOn],
    }, { dependsOn: [bindCmsCommand] });

    const bindCrmCommand = new command.local.Command("bind-crm-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${crmSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${args.nginxApp.name} \
        --environment ${args.environmentName} \
        --validation-method CNAME`,
        triggers: [args.nginxApp.systemData.lastModifiedAt, args.asuidCrmRecords.modifiedOn, args.cnameCrmEntries.modifiedOn],
    }, { dependsOn: [bindMapCommand] });

    // 2. Create Managed Certificates after domain is mapped
    const cmsCert = new azure_app.ManagedCertificate("cmsCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `${cmsSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${cmsSubdomain}.${domain}`,
        },
    }, { dependsOn: [bindCmsCommand] });

    const mapCert = new azure_app.ManagedCertificate("mapCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `${mapSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${mapSubdomain}.${domain}`,
        },
    }, { dependsOn: [bindMapCommand] });

    const crmCert = new azure_app.ManagedCertificate("crmCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `${crmSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${crmSubdomain}.${domain}`,
        },
    }, { dependsOn: [bindCrmCommand] });


    return [
        { cert: crmCert, bindCommand: bindCrmCommand },
        { cert: cmsCert, bindCommand: bindCmsCommand },
        { cert: mapCert, bindCommand: bindMapCommand },
    ];
}