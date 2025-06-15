import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { infra } from "../../stackRefs"; 
import * as command from "@pulumi/command";

const marketing_env = infra.getOutput("marketing_env_id");

// Create the interface for the DNS entries
export interface CloudflareDNSEntries {
    cmsCNAME: cloudflare.DnsRecord;
    cmsTXT: cloudflare.DnsRecord;
    crmCNAME: cloudflare.DnsRecord;
    crmTXT: cloudflare.DnsRecord;
    mapCNAME: cloudflare.DnsRecord;
    mapTXT: cloudflare.DnsRecord;
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
    
    // Assign zoneId as Output<string> (never undefined)
    const zoneId = zoneOutput.apply(zone => zone.zoneId || "");
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
        content: pulumi.interpolate`${props.nginxCvid}`,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp, cmsCNAME ]});

    // Wait for CMS TXT record to propagate
    const waitForCmsTxt = new command.local.Command(`wait-for-cms-txt`, {
        create: pulumi.interpolate`until dig +short TXT asuid.${props.cmsSubdomain}.${props.domain} | grep -q ${props.nginxCvid}; do echo waiting for DNS...; sleep 5; done`,
    }, { dependsOn: [cmsTXT] });

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
        content: pulumi.interpolate`${props.nginxCvid}`,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp, crmCNAME ]});

    // Wait for CRM TXT record to propagate
    const waitForCrmTxt = new command.local.Command(`wait-for-crm-txt`, {
        create: pulumi.interpolate`until dig +short TXT asuid.${props.crmSubdomain}.${props.domain} | grep -q ${props.nginxCvid}; do echo waiting for DNS...; sleep 5; done`,
    }, { dependsOn: [crmTXT] });

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
        content: pulumi.interpolate`${props.nginxCvid}`,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp,mapCNAME ]});

    // Wait for MAP TXT record to propagate
    const waitForMapTxt = new command.local.Command(`wait-for-map-txt`, {
        create: pulumi.interpolate`until dig +short TXT asuid.${props.mapSubdomain}.${props.domain} | grep -q ${props.nginxCvid}; do echo waiting for DNS...; sleep 5; done`,
    }, { dependsOn: [mapTXT] });

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
        cmsCNAME: cmsCNAME,
        cmsTXT: cmsTXT,
        crmCNAME: crmCNAME,
        crmTXT: crmTXT,
        mapCNAME: mapCNAME,
        mapTXT: mapTXT
    };

    // Return wait commands as well for downstream dependsOn
    return { ...dnsentries, waitForCmsTxt, waitForCrmTxt, waitForMapTxt };
};


