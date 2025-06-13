import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { infra } from "../../stackRefs"; 

const marketing_env = infra.getOutput("marketing_env_id");

// Create the interface for the DNS entries
export interface CloudflareDNSEntries {
    cmsCNAME: pulumi.Output<cloudflare.DnsRecord>;
    cmsTXT: pulumi.Output<cloudflare.DnsRecord>;
    crmCNAME: pulumi.Output<cloudflare.DnsRecord>;
    crmTXT: pulumi.Output<cloudflare.DnsRecord>;
    mapCNAME: pulumi.Output<cloudflare.DnsRecord>;
    mapTXT: pulumi.Output<cloudflare.DnsRecord>;
}


export interface CustomDomainProps {
    domain: string;
    cmsSubdomain: string;
    crmSubdomain: string;
    mapSubdomain: string;
    siteFQDN: pulumi.Output<string>;
    nginxCvid: pulumi.Output<string>
    mauticNginxApp: azure_app.ContainerApp;
    strapiApp: azure_app.ContainerApp;
    strapiFQDN: pulumi.Output<string>;
    suiteCrmApp: azure_app.ContainerApp;
    suiteCrmFQDN: pulumi.Output<string>;
}

export function setupDns(props: CustomDomainProps) {
    // Look up the Cloudflare zone for the domain
    const zonePromise = cloudflare.getZone({ filter: { name: props.domain } });
    const zoneOutput = pulumi.output(zonePromise);
    pulumi.log.info(`Looking up DNS zone for domain: ${props.domain}`);
    // Log the full zone lookup result for diagnostics
    zoneOutput.apply(zone => {
        pulumi.log.info(`Zone lookup result: ${JSON.stringify(zone)}`);
        if (!zone || !zone.zoneId) {
            throw new Error(`Cloudflare zone not found for domain: ${props.domain}. Check that the domain exists in your Cloudflare account and that your API token has permission.`);
        }
        pulumi.log.info(`Fetched Zone ID: ${zone.zoneId}`);
        return zone.zoneId;
    });
    // Assign zoneId as Output<string> (never undefined)
    const zoneId = zoneOutput.apply(zone => {
        pulumi.log.info(`Zone lookup result: ${JSON.stringify(zone)}`);
        if (!zone || !zone.zoneId) {
            throw new Error(`Cloudflare zone not found for domain: ${props.domain}. Check that the domain exists in your Cloudflare account and that your API token has permission.`);
        }
        pulumi.log.info(`Fetched Zone ID: ${zone.zoneId}`);
        return zone.zoneId;
    });
    // Add options to prevent errors if records exist
    const dnsOptions = {
        deleteBeforeCreate: true,
        replaceOnChanges: ["content", "type", "ttl", "name", "zoneId"],
        retainOnDelete: false
    };

    // Create DNS records for CMS
    const cmsCNAME = new cloudflare.DnsRecord(props.cmsSubdomain, {
        zoneId: zoneId,
        name: `${props.cmsSubdomain}`,
        type: "CNAME",
        content: props.strapiFQDN,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp ]});

    const cmsTXT = new cloudflare.DnsRecord(`asuid.${props.cmsSubdomain}`, {
        zoneId: zoneId,
        name: `asuid.${props.cmsSubdomain}`,
        type: "TXT",
        content: pulumi.interpolate`"${props.nginxCvid}"`,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp, cmsCNAME ]});

    // Create DNS records for CRM
    const crmCNAME = new cloudflare.DnsRecord(props.crmSubdomain, {
        zoneId: zoneId,
        name: `${props.crmSubdomain}`,
        type: "CNAME",
        content: props.siteFQDN,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp,  ]});

    const crmTXT = new cloudflare.DnsRecord(`asuid.${props.crmSubdomain}`, {
        zoneId: zoneId,
        name: `asuid.${props.crmSubdomain}`,
        type: "TXT",
        content: pulumi.interpolate`"${props.nginxCvid}"`,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp, crmCNAME ]});

    // Create DNS records for MAP
    const mapCNAME = new cloudflare.DnsRecord(props.mapSubdomain, {
        zoneId: zoneId,
        name: `${props.mapSubdomain}`,
        type: "CNAME",
        content: props.siteFQDN,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp ]});

    const mapTXT = new cloudflare.DnsRecord(`asuid.${props.mapSubdomain}`, {
        zoneId: zoneId,
        name: `asuid.${props.mapSubdomain}`,
        type: "TXT",
        content: pulumi.interpolate`"${props.nginxCvid}"`,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp,mapCNAME ]});
    // Remove root domain DNS record creation for now
    // const rootCNAME = new cloudflare.DnsRecord("root", {
    //     zoneId: zoneId,
    //     name: '@',
    //     type: "A",
    //     content: props.siteFQDN,
    //     ttl: 3600,
    // },{
    //     ...dnsOptions,
    //     dependsOn: [ props.mauticNginxApp ]});

    // const rootTXT = new cloudflare.DnsRecord("asuid.root", {
    //     zoneId: zoneId,
    //     name: `asuid`,
    //     type: "TXT",
    //     content: props.nginxCvid,
    //     ttl: 3600,
    // },{
    //     ...dnsOptions,
    //     dependsOn: [ props.mauticNginxApp ]
    // });
    // Remove rootCNAME and rootTXT from dnsentries
    const dnsentries: CloudflareDNSEntries = {
        cmsCNAME: pulumi.output(cmsCNAME),
        cmsTXT: pulumi.output(cmsTXT),
        crmCNAME: pulumi.output(crmCNAME),
        crmTXT: pulumi.output(crmTXT),
        mapCNAME: pulumi.output(mapCNAME),
        mapTXT: pulumi.output(mapTXT)
    };

    return   dnsentries;
};


