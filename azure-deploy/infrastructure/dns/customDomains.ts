import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { infra } from "../../stackRefs"; 

const marketing_env = infra.getOutput("marketing_env_id");

// Create the interface for the DNS entries
export interface CloudflareDNSEntries {
    cmsCNAME: cloudflare.DnsRecord;
    cmsTXT: cloudflare.DnsRecord;
    crmCNAME: cloudflare.DnsRecord;
    crmTXT: cloudflare.DnsRecord;
    mapCNAME: cloudflare.DnsRecord;
    mapTXT: cloudflare.DnsRecord;
    devCmsCNAME: cloudflare.DnsRecord;
    devCmsTXT: cloudflare.DnsRecord;
    rootCNAME: cloudflare.DnsRecord;
    rootTXT: cloudflare.DnsRecord;
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
    devStrapiApp?: azure_app.ContainerApp;
    devStrapiFQDN?: pulumi.Output<string>;
}

export function setupDns(props: CustomDomainProps) {
    // Look up the Cloudflare zone for the domain
    const zoneOutput = pulumi.output(cloudflare.getZone({ filter: { name: props.domain } }));

    zoneOutput.apply(zone => {
        pulumi.log.info(`Fetched Zone ID: ${zone.id}`);
    });
    const zoneId = zoneOutput.id;
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
        content: props.nginxCvid,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp, cmsCNAME ]});

    const devCmsCNAME = new cloudflare.DnsRecord(`dev.${props.cmsSubdomain}`, {
        zoneId: zoneId,
        name: `dev.${props.cmsSubdomain}`,
        type: "CNAME",
        content: props.siteFQDN,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp ]});

    const devCmsTXT = new cloudflare.DnsRecord(`asuid.dev.${props.cmsSubdomain}`, {
        zoneId: zoneId,
        name: `asuid.dev.${props.cmsSubdomain}`,
        type: "TXT",
        content: props.nginxCvid,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp, devCmsCNAME ]
    });
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
        content: props.nginxCvid,
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
        content: props.nginxCvid,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp,mapCNAME ]});
    // Create DNS records for root domain
    const rootCNAME = new cloudflare.DnsRecord("root", {
        zoneId: zoneId,
        name: "@",
        type: "CNAME",
        content: props.siteFQDN,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp ]});

    const rootTXT = new cloudflare.DnsRecord("asuid.root", {
        zoneId: zoneId,
        name: `asuid`,
        type: "TXT",
        content: props.nginxCvid,
        ttl: 3600,
    },{
        ...dnsOptions,
        dependsOn: [ props.mauticNginxApp, rootCNAME ]
    });    
    const dnsentries: CloudflareDNSEntries = {
        cmsCNAME: cmsCNAME,
        cmsTXT: cmsTXT,
        crmCNAME: crmCNAME,
        crmTXT: crmTXT,
        mapCNAME: mapCNAME,
        mapTXT: mapTXT,
        devCmsCNAME: devCmsCNAME,
        devCmsTXT: devCmsTXT,
        rootCNAME: rootCNAME,
        rootTXT: rootTXT
    };

    return   dnsentries;
};


