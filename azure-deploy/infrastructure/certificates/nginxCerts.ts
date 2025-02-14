import * as pulumi from "@pulumi/pulumi";
import { v20241002preview as azure_app } from "@pulumi/azure-native/app";
//import * as azure from "@pulumi/azure";
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
    environment: azure_app.ManagedEnvironment
) {
    const crmCert = new azure_app.ManagedCertificate("crmCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environment.name,
        managedCertificateName: `${crmSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${crmSubdomain}.${domain}`,
        },
    }, { dependsOn: [nginxApp] });
            
    const cmsCert = new azure_app.ManagedCertificate("cmsCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environment.name,
        managedCertificateName: `${cmsSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${cmsSubdomain}.${domain}`,
        },
    }, { dependsOn: [strapiApp] });
        
    const mapCert = new azure_app.ManagedCertificate("mapCert", {
        resourceGroupName: resourceGroupName,
        environmentName: environment.name,
        managedCertificateName: `${mapSubdomain}`,
        properties: {
            domainControlValidation: "CNAME",
            subjectName: `${mapSubdomain}.${domain}`,
        },
    }, { dependsOn: [nginxApp] });   

        // Use azure-native to bind custom domains with the managed certificates
    const bindCmsCommand = new command.local.Command("bind-cms-custom-domain", {
        create: pulumi.interpolate `az containerapp hostname bind \
        --hostname ${cmsSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${strapiApp.name} \
        --environment ${environment.name} \
        --validation-method CNAME`,
        triggers: [cmsCert.systemData.lastModifiedAt,nginxApp.systemData.lastModifiedAt],
    }, { dependsOn: [cmsCert, strapiApp, environment] });

    const bindMapCommand = new command.local.Command("bind-map-custom-domain", {
        create: pulumi.interpolate `az containerapp hostname bind \
        --hostname ${mapSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${nginxApp.name} \
        --environment ${environment.name} \
        --validation-method CNAME`,
        triggers: [mapCert.systemData.lastModifiedAt, nginxApp.systemData.lastModifiedAt],
    }, { dependsOn: [mapCert, nginxApp, environment, bindCmsCommand] });

    const bindCrmCommand = new command.local.Command("bind-crm-custom-domain", {
        create: pulumi.interpolate `az containerapp hostname bind \
        --hostname ${crmSubdomain}.${domain} \
        -g ${resourceGroupName} -n ${nginxApp.name} \
        --environment ${environment.name} \
        --validation-method CNAME`,
        triggers: [crmCert.systemData.lastModifiedAt, nginxApp.systemData.lastModifiedAt],
    }, { dependsOn: [crmCert, nginxApp, environment, bindCmsCommand, bindMapCommand] });
       
    return [crmCert, cmsCert, mapCert ];



}