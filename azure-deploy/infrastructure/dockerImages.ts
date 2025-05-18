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

// Set Docker registry environment variables dynamically at runtime
registryUrl.apply(url => {
  process.env.DOCKER_SERVER = url;
});
acrUsername.apply(username => {
  process.env.DOCKER_USERNAME = username;
});
acrPassword.apply(password => {
  process.env.DOCKER_PASSWORD = password;
});

for (const imageName of imageNames) {
  // The full remote tag (with registry name)
  const remoteTag = registryUrl.apply(url => `${url}/${imageName}:${imageTag}`);
  imageBuilds[imageName] = remoteTag;

  new docker.RegistryImage(imageName, {
    name: remoteTag, // Remote ACR image name (with registry)
    keepRemotely: true,
  });
}

// Export the image builds so they can be used elsewhere in the Pulumi stack
export { imageBuilds };
