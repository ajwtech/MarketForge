import * as pulumi from '@pulumi/pulumi';
import * as dockerbuild from '@pulumi/docker-build';
import { marketingcr, acrUsername, acrPassword, registryUrl } from './registries/acrRegistry';

const config = new pulumi.Config();
const imageTag = config.get('imageTag') || 'latest';
const imageNames = [
  'marketing-nginx',
  'marketing-mautic_web',
];
const imageBuilds: { [key: string]: dockerbuild.Image } = {};

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
