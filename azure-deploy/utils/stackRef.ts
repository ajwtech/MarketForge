import * as pulumi from "@pulumi/pulumi";

/**
 * Returns a fully qualified Pulumi stack reference name in the form <org>/<project>/<stack>.
 * - Uses ENV_ESC to extract org/project.
 * - Uses config.require(stackNameConfigKey) or falls back to stackNameConfigKey.
 */
export function getStackRefName(config: pulumi.Config, stackNameConfigKey: string): string {
    const envEsc = process.env.ENV_ESC;
    if (!envEsc) {
        throw new Error("ENV_ESC environment variable is required");
    }
    const orgProject = envEsc.slice(0, envEsc.lastIndexOf("/"));
    let stack: string;
    try {
        stack = config.require(stackNameConfigKey) || stackNameConfigKey;
    } catch {
        stack = stackNameConfigKey;
    }
    return `${orgProject}/${stack}`;
}
