import * as pulumi from "@pulumi/pulumi";
import * as docker from "@pulumi/docker";
import { marketingcr, acrUsername, acrPassword, registryUrl } from "./registries/acrRegistry";

const config = new pulumi.Config();
const imageTag = config.get("imageTag") || "latest";

const imageNames = [
    "marketing-nginx",
    "marketing-mautic_cron",
    "marketing-mautic_web",
    "marketing-mautic_worker",
    "marketing-mautic_init"
];

const imageBuilds: { [key: string]: docker.Image } = {};

imageNames.forEach(imageName => {
    imageBuilds[imageName] = new docker.Image(imageName, {
        imageName: pulumi.interpolate`${registryUrl}/${imageName}:${imageTag}`,
        build: {
            context: ".", 
            dockerfile: `Dockerfile`,
            platform: "linux/amd64", 
        },
        registry: {
            server: registryUrl,
            username: acrUsername,
            password: acrPassword,
        },
    }, { 
        dependsOn: [marketingcr],
        ignoreChanges: ["build"],
    });
});

export { imageBuilds };