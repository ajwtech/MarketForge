import * as pulumi from '@pulumi/pulumi';
import * as dockerbuild from '@pulumi/docker-build';
import { marketingcr, acrUsername, acrPassword, registryUrl } from './registries/acrRegistry';

const config = new pulumi.Config();
const imageTag = config.get('imageTag') || 'latest';
const mauticAppVersion = config.get('appVersion') || '5.2.1';
const imageNames = [
  'marketing-nginx',
  'marketing-mautic-app',
  'marketing-strapi-app',
  'marketing-vtiger-app', // Added new image
];
const imageBuilds: { [key: string]: dockerbuild.Image } = {};

const imageConfigs: { [key: string]: { context: string, dockerfile: string } } = {
  'marketing-nginx': { context: '../', dockerfile: '../mautic/marketing-nginx.dockerfile' },
  'marketing-mautic-app': { context: '../mautic', dockerfile: '../mautic/marketing-mautic-app.dockerfile' },
  'marketing-strapi-app': { context: '../strapi', dockerfile: '../strapi/Dockerfile.prod' },
  'marketing-vtiger-app': { context: '../vtigercrm', dockerfile: '../vtigercrm/marketing-vtiger-app.dockerfile' },
};

// Wait for the ACR to be created before proceeding

const registry = registryUrl.apply(registry => registry);

for (const imageName of imageNames) {
  const fullImageName = pulumi.interpolate`${registry}/${imageName}:${imageTag}`;
  const config = imageConfigs[imageName];
  // Define the dockerbuild.Image resource
  imageBuilds[imageName] = new dockerbuild.Image(
    imageName,
    {
      buildArgs: {
        APP_VERSION: mauticAppVersion,
      },
      context: {
        location: config.context,
      },
      push: true,
      dockerfile: {
        location: config.dockerfile,
      },
      platforms: ['linux/amd64'],
      registries: [{
        address: registry,
        username: acrUsername,
        password: acrPassword,
      }],
      tags: [fullImageName],
    }, {
      dependsOn: [marketingcr],
    });
}

// Export the image builds so they can be used elsewhere in the Pulumi stack
export { imageBuilds };
