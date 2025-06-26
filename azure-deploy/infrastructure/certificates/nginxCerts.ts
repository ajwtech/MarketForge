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
const strapiAppId = apps.requireOutput("deployedStrapiApp").apply(app => app.id);
const nginxAppId = apps.requireOutput("mauticNginxApp").apply(app => app.id);

const cmsCustomHostBindingId = pulumi.interpolate`${strapiAppId}/customHostNameBindings/${cmsSubdomain}.${domain}`;
const mapCustomHostBindingId = pulumi.interpolate`${nginxAppId}/customHostNameBindings/${mapSubdomain}.${domain}`;
const crmCustomHostBindingId = pulumi.interpolate`${nginxAppId}/customHostNameBindings/${crmSubdomain}.${domain}`;

interface WaitForHealthyDomainArgs {
    resourceId: pulumi.Input<string>;
    commandName: string;
    dependsOn?: pulumi.Input<pulumi.Resource>[];
}

export function waitForHealthyDomain(args: WaitForHealthyDomainArgs): command.local.Command {
    pulumi.log.info(`Waiting for ${args.commandName} to become healthy, this can take up to 20 minutes...`);
    return new command.local.Command(args.commandName, {
        create: pulumi.interpolate`
            az resource wait \
              --ids ${args.resourceId} \
              --custom "properties.validationState=='Healthy'"
        `,
    }, { dependsOn: args.dependsOn });
}

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

    // 2. Wait for domains to be healthy
    const waitForHealthyCms = waitForHealthyDomain({
        resourceId: cmsCustomHostBindingId,
        commandName: "wait-for-healthy-cms",
        dependsOn: [bindCmsCommand],
    });

    const waitForHealthyMap = waitForHealthyDomain({
        resourceId: mapCustomHostBindingId,
        commandName: "wait-for-healthy-map",
        dependsOn: [bindMapCommand],
    });

    const waitForHealthyCrm = waitForHealthyDomain({
        resourceId: crmCustomHostBindingId,
        commandName: "wait-for-healthy-crm",
        dependsOn: [bindCrmCommand],
    });



    // 3. Create Managed Certificates after domain is mapped
    const cmsCert = new azure_app.ManagedCertificate("cmsCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `${cmsSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${cmsSubdomain}.${domain}`,
        },
    }, { dependsOn: [waitForHealthyCms] });

    const mapCert = new azure_app.ManagedCertificate("mapCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `${mapSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${mapSubdomain}.${domain}`,
        },
    }, { dependsOn: [waitForHealthyMap] });

    const crmCert = new azure_app.ManagedCertificate("crmCert", {
        resourceGroupName: resourceGroupName,
        environmentName: args.environmentName,
        managedCertificateName: `${crmSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${crmSubdomain}.${domain}`,
        },
    }, { dependsOn: [waitForHealthyCrm] });


    return [
        { cert: crmCert, bindCommand: bindCrmCommand },
        { cert: cmsCert, bindCommand: bindCmsCommand },
        { cert: mapCert, bindCommand: bindMapCommand },
    ];
}