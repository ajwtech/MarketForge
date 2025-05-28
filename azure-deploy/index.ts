import * as automation from "@pulumi/pulumi/automation";
import * as pulumi from "@pulumi/pulumi";
import { JsonMapperElement } from "@pulumi/azure-native/monitor/v20241001preview";
import { JobStepActionSource } from "@pulumi/azure-native/sql/v20230501preview";
// Helper to extract project and environment from escEnv format is "project/environment"
function parseEscEnv(escEnv: string | undefined): { project: string, env: string } {
  if (!escEnv) {
    throw new Error("ESC environment is undefined");
  }
  const escParts = escEnv.split("/");
  if (escParts.length < 2) {
    throw new Error(`Invalid ESC environment format: ${escEnv}`);
  }
  return {
    project: escParts[escParts.length - 2],
    env: escParts[escParts.length - 1],
  };
}

const escEnv = process.env.ENV_ESC;
const { project, env } = parseEscEnv(escEnv);

function getProjectName(): string {
  return project;
}

// Run the stack code inside the Automation API program so ESC config is merged
async function runStackWithEscEnv(stackName: string, projectName: string, stackModule: string) {
  const stackArgs = {
    stackName,
    projectName,
    program: async () => {
      // Use import instead of require for stack modules
      const mod = await import(stackModule);
      if (typeof mod.returnOutputs === "function") {
        return mod.returnOutputs();
      }
    },
  };
  const stack = await automation.LocalWorkspace.createOrSelectStack(stackArgs);
  await stack.addEnvironments(`${project}/${env}`);
  return await stack.up();
  
}

// Entrypoint for modular Pulumi stacks
async function main() {
  const job = process.env.GITHUB_JOB;
  const projectName = getProjectName();
  switch (job) {
    case "setup-acr-infra":
      return await runStackWithEscEnv(job, projectName, "./acrStack");
    case "setup-infra":
      return await runStackWithEscEnv(job, projectName, "./infraStack");
    case "setup-apps":
      return await runStackWithEscEnv(job, projectName, "./appsStack");
    default:
      throw new Error(`Unknown job: ${job}`);
  }

}
main().catch(err => {
  console.error(err);
  process.exit(1);
});