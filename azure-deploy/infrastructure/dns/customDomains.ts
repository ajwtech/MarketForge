import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";

export interface AsuidDnsProps {
    domain: string;
    cmsSubdomain: string;
    crmSubdomain: string;
    mapSubdomain: string;
    betaSubdomain: string;
    siteFQDN: pulumi.Output<string>;
    nginxCvid: pulumi.Output<string>;
}

export interface CnameDnsProps {
    domain: string;
    cmsSubdomain: string;
    crmSubdomain: string;
    mapSubdomain: string;
    betaSubdomain: string;
    siteFQDN: pulumi.Output<string>;
    suiteCrmFQDN: pulumi.Output<string>;
    strapiFQDN: pulumi.Output<string>;
    mauticNginxFQDN: pulumi.Output<string>;
}

export function setupAsuidDnsRecords(props: AsuidDnsProps) {
    pulumi.log.info(`Setting up asuid TXT DNS records for domain: ${props.domain}`);
    const zonePromise = cloudflare.getZone({ filter: { name: props.domain } });
    const zoneOutput = pulumi.output(zonePromise);
    const zoneId = zoneOutput.apply(zone => {
        if (!zone || !zone.zoneId) {
            pulumi.log.error(`Failed to find Cloudflare zone for domain: ${props.domain}`);
            throw new Error(`Cloudflare zone not found for domain: ${props.domain}`);
        }
        return zone.zoneId;
    });
    const dnsOptions = {
        replaceOnChanges: ["content", "type", "ttl", "name", "zoneId"]
    };
    const cmsTXT = new cloudflare.DnsRecord(`asuid.${props.cmsSubdomain}`, {
        zoneId: zoneId,
        name: `asuid.${props.cmsSubdomain}`,
        type: "TXT",
        content: props.nginxCvid.apply(cvid => `"${cvid}"` || ""),
        ttl: 3600,
    }, { ...dnsOptions });
    const crmTXT = new cloudflare.DnsRecord(`asuid.${props.crmSubdomain}`, {
        zoneId: zoneId,
        name: `asuid.${props.crmSubdomain}`,
        type: "TXT",
        content: props.nginxCvid.apply(cvid => `"${cvid}"` || ""),
        ttl: 3600,
    }, { ...dnsOptions });
    const mapTXT = new cloudflare.DnsRecord(`asuid.${props.mapSubdomain}`, {
        zoneId: zoneId,
        name: `asuid.${props.mapSubdomain}`,
        type: "TXT",
        content: props.nginxCvid.apply(cvid => `"${cvid}"` || ""),
        ttl: 3600,
    }, { ...dnsOptions });
    
    const betaTXT = new cloudflare.DnsRecord(`asuid.${props.betaSubdomain}`, {
        zoneId: zoneId,
        name: `asuid.${props.betaSubdomain}`,
        type: "TXT",
        content: props.nginxCvid.apply(cvid => `"${cvid}"` || ""),
        ttl: 3600,
    }, { ...dnsOptions });
    
    return { cmsTXT, crmTXT, mapTXT, betaTXT };
}

export function setupCnameDnsRecords(props: CnameDnsProps) {
    pulumi.log.info(`Setting up CNAME DNS records for domain: ${props.domain}`);
    const zonePromise = cloudflare.getZone({ filter: { name: props.domain } });
    const zoneOutput = pulumi.output(zonePromise);
    const zoneId = zoneOutput.apply(zone => {
        if (!zone || !zone.zoneId) {
            pulumi.log.error(`Failed to find Cloudflare zone for domain: ${props.domain}`);
            throw new Error(`Cloudflare zone not found for domain: ${props.domain}`);
        }
        return zone.zoneId;
    });
    const dnsOptions = {
        replaceOnChanges: ["content", "type", "ttl", "name", "zoneId"],
    };
    const cmsCNAME = new cloudflare.DnsRecord(props.cmsSubdomain, {
        zoneId: zoneId,
        name: props.cmsSubdomain,
        type: "CNAME",
        content: props.strapiFQDN,
        ttl: 3600,
    }, { ...dnsOptions });
    const crmCNAME = new cloudflare.DnsRecord(props.crmSubdomain, {
        zoneId: zoneId,
        name: props.crmSubdomain,
        type: "CNAME",
        content: props.suiteCrmFQDN,
        ttl: 3600,
    }, { ...dnsOptions });
    const mapCNAME = new cloudflare.DnsRecord(props.mapSubdomain, {
        zoneId: zoneId,
        name: props.mapSubdomain,
        type: "CNAME",
        content: props.mauticNginxFQDN.apply(fqdn => fqdn || ""),
        ttl: 3600,
    }, { ...dnsOptions });
    
    const betaCNAME = new cloudflare.DnsRecord(props.betaSubdomain, {
        zoneId: zoneId,
        name: props.betaSubdomain,
        type: "CNAME",
        content: props.strapiFQDN,
        ttl: 3600,
    }, { ...dnsOptions });
    
    return { cmsCNAME, crmCNAME, mapCNAME, betaCNAME };
}


