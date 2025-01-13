import * as pulumi from '@pulumi/pulumi';
import * as dockerbuild from '@pulumi/docker-build';
import { marketingcr, acrUsername, acrPassword, registryUrl } from './registries/acrRegistry';
import * as command  from "@pulumi/command";

const config = new pulumi.Config();
const imageTag = config.get('imageTag') || 'latest';
const imageNames = [
  'marketing-nginx',
  'marketing-mautic_web',
  ////uncomment the following lines to build the images for the marketing-mautic_cron and marketing-mautic_worker
  // 'marketing-mautic_cron',
  // 'marketing-mautic_worker',
];
const pushImages = config.get('pushImages') || 'false'
const imageBuilds: { [key: string]: dockerbuild.Image } = {};

// Use Azure CLI to check if the image exists in ACR
function imageExists(acrName: string, imageName: string ): pulumi.Output<boolean> {
    try {
      if (pushImages === 'true') {
        return pulumi.output(true);
    }
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
      // Define the dockerbuild.Image resource
      imageBuilds[imageName] = new dockerbuild.Image(
        imageName,
        {
          context: {
            location: '../mautic',
          },
          push: true,
          dockerfile: {
            location: `../mautic/${imageName}.dockerfile`,
          },
          platforms: ['linux/amd64'],

          registries: [{
            address: registry,
            username: acrUsername,
            password: acrPassword,
          }],
          tags: [fullImageName],
    });
    }
  });
});

// Export the image builds so they can be used elsewhere in the Pulumi stack
export { imageBuilds };
