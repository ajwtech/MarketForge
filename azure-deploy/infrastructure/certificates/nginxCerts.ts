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
    cloudflareDNSentries: (import("../dns/customDomains").CloudflareDNSEntries & {
        waitForCmsTxt?: command.local.Command,
        waitForCrmTxt?: command.local.Command,
        waitForMapTxt?: command.local.Command,
    }) | undefined,
): Array<{ cert: azure_app.ManagedCertificate, bindCommand: command.local.Command }> {
    // Early return if no cloudflareDNSentries provided
    if (!cloudflareDNSentries) {
        console.log("No Cloudflare DNS entries provided, skipping certificate creation");
        return [];
    }

    // Use the wait commands for proper DNS propagation
    const bindCmsDependsOn = [strapiApp, cloudflareDNSentries.cmsCNAME, cloudflareDNSentries.cmsTXT, cloudflareDNSentries.waitForCmsTxt].filter(Boolean) as pulumi.Input<pulumi.Resource>[];
    const bindCmsCommand = new command.local.Command("bind-cms-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${cmsSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${strapiApp.name} \
        --environment ${environmentName} \
        --validation-method CNAME`,
        triggers: [strapiApp.systemData.lastModifiedAt, cloudflareDNSentries.cmsCNAME, cloudflareDNSentries.cmsTXT],
    }, { dependsOn: bindCmsDependsOn });

    const bindMapDependsOn = [nginxApp, cloudflareDNSentries.mapCNAME, cloudflareDNSentries.mapTXT, bindCmsCommand, cloudflareDNSentries.waitForMapTxt].filter(Boolean) as pulumi.Input<pulumi.Resource>[];
    const bindMapCommand = new command.local.Command("bind-map-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${mapSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${nginxApp.name} \
        --environment ${environmentName} \
        --validation-method CNAME`,
        triggers: [nginxApp.systemData.lastModifiedAt, cloudflareDNSentries.mapCNAME, cloudflareDNSentries.mapTXT],
    }, { dependsOn: bindMapDependsOn });

    const bindCrmDependsOn = [nginxApp, cloudflareDNSentries.crmCNAME, cloudflareDNSentries.crmTXT, bindMapCommand, cloudflareDNSentries.waitForCrmTxt].filter(Boolean) as pulumi.Input<pulumi.Resource>[];
    const bindCrmCommand = new command.local.Command("bind-crm-custom-domain", {
        create: pulumi.interpolate`az containerapp hostname bind \
        --hostname ${crmSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${nginxApp.name} \
        --environment ${environmentName} \
        --validation-method CNAME`,
        triggers: [nginxApp.systemData.lastModifiedAt, cloudflareDNSentries.crmCNAME, cloudflareDNSentries.crmTXT],
    }, { dependsOn: bindCrmDependsOn });

    // 2. Create Managed Certificates after domain is mapped
    const cmsCert = new azure_app.ManagedCertificate("cmsCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environmentName,
        managedCertificateName: `${cmsSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${cmsSubdomain}.${domain}`,
        },
    }, { dependsOn: [bindCmsCommand] });

    const mapCert = new azure_app.ManagedCertificate("mapCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environmentName,
        managedCertificateName: `${mapSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${mapSubdomain}.${domain}`,
        },
    }, { dependsOn: [bindMapCommand] });

    const crmCert = new azure_app.ManagedCertificate("crmCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environmentName,
        managedCertificateName: `${crmSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${crmSubdomain}.${domain}`,
        },
    }, { dependsOn: [bindCrmCommand] });

    // Optionally, you may want to update the app to use the new cert after it's issued (not shown here)

    return [
        { cert: crmCert, bindCommand: bindCrmCommand },
        { cert: cmsCert, bindCommand: bindCmsCommand },
        { cert: mapCert, bindCommand: bindMapCommand },
    ];
}