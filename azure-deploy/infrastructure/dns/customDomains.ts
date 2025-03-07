import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { marketing_env } from "../managedEnvironment/managedEnvironment"; 


// Create the interface for the DNS entries
export interface CloudflareDNSEntries {
    cmsCNAME: cloudflare.Record;
    cmsTXT: cloudflare.Record;
    crmCNAME: cloudflare.Record;
    crmTXT: cloudflare.Record;
    mapCNAME: cloudflare.Record;
    mapTXT: cloudflare.Record;
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
    const zone = cloudflare.getZone({ name: props.domain });

    // Create DNS records for CMS
    const cmsCNAME = new cloudflare.Record(props.cmsSubdomain, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `${props.cmsSubdomain}`,
        type: "CNAME",
        content: props.strapiFQDN,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.strapiApp ]});

    const cmsTXT = new cloudflare.Record(`asuid.${props.cmsSubdomain}`, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `asuid.${props.cmsSubdomain}`,
        type: "TXT",
        content: props.nginxCvid,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.strapiApp ]});

    // Create DNS records for CRM
    const crmCNAME = new cloudflare.Record(props.crmSubdomain, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `${props.crmSubdomain}`,
        type: "CNAME",
        content: props.siteFQDN,
        ttl: 3600,
    },{
        
        dependsOn: [marketing_env, props.mauticNginxApp, props.suiteCrmApp ]});

    const crmTXT = new cloudflare.Record(`asuid.${props.crmSubdomain}`, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `asuid.${props.crmSubdomain}`,
        type: "TXT",
        content: props.nginxCvid,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.mauticNginxApp, props.suiteCrmApp ]});

    // Create DNS records for MAP
    const mapCNAME = new cloudflare.Record(props.mapSubdomain, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `${props.mapSubdomain}`,
        type: "CNAME",
        content: props.siteFQDN,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.mauticNginxApp ]});

    const mapTXT = new cloudflare.Record(`asuid.${props.mapSubdomain}`, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `asuid.${props.mapSubdomain}`,
        type: "TXT",
        content: props.nginxCvid,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.mauticNginxApp ]});
    
    const dnsentries: CloudflareDNSEntries = {
        cmsCNAME: cmsCNAME,
        cmsTXT: cmsTXT,
        crmCNAME: crmCNAME,
        crmTXT: crmTXT,
        mapCNAME: mapCNAME,
        mapTXT: mapTXT,
    };

    return   dnsentries;
};


