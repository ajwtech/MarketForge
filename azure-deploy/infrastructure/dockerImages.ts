import * as pulumi from '@pulumi/pulumi';
import * as docker from '@pulumi/docker';
import { registryUrl, acrUsername, acrPassword } from './registries/acrRegistry';

const config = new pulumi.Config();
const imageTag = config.get('imageTag') || 'latest';

const imageNames = [
  'marketing-nginx',
  'marketing-mautic-app',
  'marketing-strapi-app',
  'marketing-suitecrm-app',
];

const imageBuilds: { [key: string]: pulumi.Output<string> } = {};

for (const imageName of imageNames) {
  const localTag = `${imageName}:latest`; // or use imageTag if you tag locally with it
  imageBuilds[imageName] = registryUrl.apply(url => `${url}/${imageName}:${imageTag}`);

  new docker.RegistryImage(imageName, {
    name: imageBuilds[imageName],
    build: undefined, // Not needed, image must already exist locally
    localImageName: localTag, // This is the local image to push
    keepRemotely: true,
    registry: {
      server: registryUrl,
      username: acrUsername,
      password: acrPassword,
    },
  });
}

// Export the image builds so they can be used elsewhere in the Pulumi stack
export { imageBuilds };
