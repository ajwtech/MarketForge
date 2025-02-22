import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import { marketing_env } from "../managedEnvironment/managedEnvironment"; 

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
    // vtigerApp: azure_app.ContainerApp;
    // vtigerFQDN: pulumi.Output<string>;
}

export function setupDns(props: CustomDomainProps) {
    // Look up the Cloudflare zone for the domain
    const zone = cloudflare.getZone({ name: props.domain });

    // Create DNS records for CMS
    const cmsCNAME = new cloudflare.Record(props.cmsSubdomain, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `${props.cmsSubdomain}.${props.domain}`,
        type: "CNAME",
        content: props.strapiFQDN,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.strapiApp ]});

    const cmsTXT = new cloudflare.Record(`asuid.${props.cmsSubdomain}`, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `asuid.${props.cmsSubdomain}.${props.domain}`,
        type: "TXT",
        content: props.nginxCvid,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.strapiApp ]});

    // // Create DNS records for CRM
    // const crmCNAME = new cloudflare.Record(props.crmSubdomain, {
    //     zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
    //     name: `${props.crmSubdomain}.${props.domain}`,
    //     type: "CNAME",
    //     content: props.siteFQDN,
    //     ttl: 3600,
    // },{dependsOn: [marketing_env, props.mauticNginxApp ]});

    // const crmTXT = new cloudflare.Record(`asuid.${props.crmSubdomain}`, {
    //     zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
    //     name: `asuid.${props.crmSubdomain}.${props.domain}`,
    //     type: "TXT",
    //     content: props.nginxCvid,
    //     ttl: 3600,
    // },{dependsOn: [marketing_env, props.mauticNginxApp ]});

    // Create DNS records for MAP
    const mapCNAME = new cloudflare.Record(props.mapSubdomain, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `${props.mapSubdomain}.${props.domain}`,
        type: "CNAME",
        content: props.siteFQDN,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.mauticNginxApp ]});

    const mapTXT = new cloudflare.Record(`asuid.${props.mapSubdomain}`, {
        zoneId: zone.then((z: cloudflare.GetZoneResult) => z.id),
        name: `asuid.${props.mapSubdomain}.${props.domain}`,
        type: "TXT",
        content: props.nginxCvid,
        ttl: 3600,
    },{dependsOn: [marketing_env, props.mauticNginxApp ]});
};


