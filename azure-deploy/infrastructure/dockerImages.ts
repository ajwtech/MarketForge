// Docker images are built and pushed in CI (GitHub Actions) after ACR is created.
// Pulumi only references pre-built image tags. No image build/push is done in Pulumi.
// Credentials for ACR are handled in CI and not in Pulumi code.
// See .github/workflows/deploy.yml for the build/push/deploy workflow.

import * as pulumi from '@pulumi/pulumi';
import { registryUrl } from './registries/acrRegistry';

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
  // The full remote tag (with registry name)
  const remoteTag = registryUrl.apply(url => `${url}/${imageName}:${imageTag}`);
  imageBuilds[imageName] = remoteTag;
}

// Export the image builds so they can be used elsewhere in the Pulumi stack
export { imageBuilds };
