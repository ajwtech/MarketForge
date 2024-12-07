import * as pulumi from '@pulumi/pulumi';
import * as docker from '@pulumi/docker';

import { DockerBuild } from '@pulumi/docker/types/input';
import { marketingcr, acrUsername, acrPassword, registryUrl } from './registries/acrRegistry';
import * as command  from "@pulumi/command";

const config = new pulumi.Config();
const imageTag = config.get('imageTag') || 'latest';
const imageNames = [
  'marketing-nginx',
  'marketing-mautic_cron',
  'marketing-mautic_web',
 // 'marketing-mautic_worker',
 // 'marketing-mautic_init',
];

const imageBuilds: { [key: string]: docker.Image } = {};

      // Use Azure CLI to check if the image exists in ACR
function imageExists(acrName: string, imageName: string ): pulumi.Output<boolean> {
    try {
        const imageExistsCommand = command.local.runOutput({
            command: pulumi.interpolate`az acr repository show-tags --name ${acrName} --repository ${imageName} -o json || echo []`,
        });
        const output =  imageExistsCommand.stdout.apply(stdout => {
            const tags = JSON.parse(stdout);
            
            return tags.includes(imageTag);
        });
        return output;
    } catch (error) {
        return pulumi.output(false);
    }
}


// Wait for the ACR to be created before proceeding
marketingcr.name.apply(acrName => {
  registryUrl.apply(registry => {
    for (const imageName of imageNames) {
      const fullImageName = pulumi.interpolate`${registry}/${imageName}:${imageTag}`;
      const buildOptions: DockerBuild = {
        context: '.',
        dockerfile: `./Dockerfile`,
        platform: 'linux/amd64',
      };

      // Define the docker.Image resource
      imageBuilds[imageName] = new docker.Image(
        imageName,
        {
          imageName: fullImageName,
          build: buildOptions,
          registry: {
            server: registry,
            username: acrUsername,
            password: acrPassword,
          },
          skipPush: imageExists(acrName,imageName)  
        },
        {

        }
      );
    }
  });
});
    // Export the image builds so they can be used elsewhere in the Pulumi stack
    export { imageBuilds };
