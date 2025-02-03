import * as pulumi from '@pulumi/pulumi';
import * as dockerbuild from '@pulumi/docker-build';
import { marketingcr, acrUsername, acrPassword, registryUrl } from './registries/acrRegistry';

const config = new pulumi.Config();
const imageTag = config.get('imageTag') || 'latest';
const mauticAppVersion = config.get('appVersion') || '5.2.1';
const imageNames = [
  'marketing-nginx',
  'marketing-mautic_web',
  'marketing-strapi-app',
];
const imageBuilds: { [key: string]: dockerbuild.Image } = {};

// Wait for the ACR to be created before proceeding

  const registry = registryUrl.apply(registry => registry);
    for (const imageName of imageNames) {
      const fullImageName = pulumi.interpolate`${registry}/${imageName}:${imageTag}`;
      // Define the dockerbuild.Image resource
      imageBuilds[imageName] = new dockerbuild.Image(
        imageName,
        {
          buildArgs: {
            APP_VERSION: mauticAppVersion,
          },
          context: {
            location: imageName === 'marketing-strapi-app' ? '../strapi' : '../mautic',
          },
          push: true,

          dockerfile: {
            location: imageName === 'marketing-strapi-app' ? '../strapi/Dockerfile.prod' : `../mautic/${imageName}.dockerfile`,
          },
          platforms: ['linux/amd64'],

          registries: [{
            address: registry,
            username: acrUsername,
            password: acrPassword,
          }],
          tags: [fullImageName],
    },{
      dependsOn: [ marketingcr ],
    });
    }


// Export the image builds so they can be used elsewhere in the Pulumi stack
export { imageBuilds };
