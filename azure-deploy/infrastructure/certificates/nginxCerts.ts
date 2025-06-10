import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
import * as command from "@pulumi/command";



const config = new pulumi.Config();
const resourceGroupName = config.require("resourceGroupName");
const domain = config.require("domain");
const mapSubdomain = config.get("mapSubdomain") || "map";
const cmsSubdomain = config.get("cmsSubdomain") || "cms";
const crmSubdomain = config.get("crmSubdomain") || "crm";



export function nginxCerts(
    nginxApp: azure_app.ContainerApp,
    strapiApp: azure_app.ContainerApp,
    environmentName: pulumi.Input<string>,
    cloudflareDNSentries: import("../dns/customDomains").CloudflareDNSEntries | undefined,
): Array<azure_app.ManagedCertificate> {
    // Early return if no cloudflareDNSentries provided
    if (!cloudflareDNSentries) {
        console.log("No Cloudflare DNS entries provided, skipping certificate creation");
        return [];
    }

    const crmCert = new azure_app.ManagedCertificate("crmCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environmentName,
        managedCertificateName: `${crmSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${crmSubdomain}.${domain}`,
        },
    }, { dependsOn: [nginxApp, cloudflareDNSentries.crmCNAME, cloudflareDNSentries.crmTXT] });
            
    const cmsCert = new azure_app.ManagedCertificate("cmsCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environmentName,
        managedCertificateName: `${cmsSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${cmsSubdomain}.${domain}`,
        },
    }, { dependsOn: [strapiApp, cloudflareDNSentries.cmsCNAME, cloudflareDNSentries.cmsTXT] });

    const mapCert = new azure_app.ManagedCertificate("mapCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environmentName,
        managedCertificateName: `${mapSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${mapSubdomain}.${domain}`,
        },
    }, { dependsOn: [nginxApp, cloudflareDNSentries.mapCNAME, cloudflareDNSentries.mapTXT] });   
        // Use azure-native to bind custom domains with the managed certificates
    
        const bindCmsCommand = new command.local.Command("bind-cms-custom-domain", {
        create: pulumi.interpolate `az containerapp hostname bind \
        --hostname ${cmsSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${strapiApp.name} \
        --environment ${environmentName} \
        --validation-method CNAME`,
        triggers: [cmsCert.systemData.lastModifiedAt, strapiApp.systemData.lastModifiedAt],
    }, { dependsOn: [cmsCert, strapiApp, cloudflareDNSentries.cmsCNAME, cloudflareDNSentries.cmsTXT] });
    
    const bindMapCommand = new command.local.Command("bind-map-custom-domain", {
        create: pulumi.interpolate `az containerapp hostname bind \
        --hostname ${mapSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${nginxApp.name} \
        --environment ${environmentName} \
        --validation-method CNAME`,
        triggers: [mapCert.systemData.lastModifiedAt, nginxApp.systemData.lastModifiedAt],
    }, { dependsOn: [mapCert, nginxApp, bindCmsCommand, cloudflareDNSentries.mapCNAME, cloudflareDNSentries.mapTXT] });

    const bindCrmCommand = new command.local.Command("bind-crm-custom-domain", {
        create: pulumi.interpolate `az containerapp hostname bind \
        --hostname ${crmSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${nginxApp.name} \
        --environment ${environmentName} \
        --validation-method CNAME`,
        triggers: [crmCert.systemData.lastModifiedAt, nginxApp.systemData.lastModifiedAt],
    }, { dependsOn: [crmCert, nginxApp, bindMapCommand, cloudflareDNSentries.crmCNAME, cloudflareDNSentries.crmTXT] });
       
    // Add root domain (WEBSITE_URL) certificate
    const rootCert = new azure_app.ManagedCertificate("rootCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environmentName,
        managedCertificateName: domain,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: domain,
        },
    }, { dependsOn: [nginxApp, cloudflareDNSentries.rootTXT] });

    // Bind root domain to the environment (frontend)
    const bindRootCommand = new command.local.Command("bind-root-custom-domain", {
        create: pulumi.interpolate `az containerapp hostname bind \
        --hostname ${domain} \
        -g ${resourceGroupName} -n ${nginxApp.name} \
        --environment ${environmentName} \
        --validation-method CNAME`,
        triggers: [rootCert.systemData.lastModifiedAt, nginxApp.systemData.lastModifiedAt],
    }, { dependsOn: [rootCert, nginxApp, cloudflareDNSentries.rootTXT] });

    return [crmCert, cmsCert, mapCert, rootCert ];



}