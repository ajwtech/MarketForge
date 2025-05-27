import * as automation from "@pulumi/pulumi/automation";

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
      const { returnOutputs } = await import(stackName);
      return returnOutputs()
    },
  };      

  const stack = await automation.LocalWorkspace.createOrSelectStack(stackArgs);
  
  await stack.refresh({ onOutput: console.info });
  
  const upRes = await stack.up();
  console.log(`update summary: \n${JSON.stringify(upRes.summary.resourceChanges, null, 4)}`);
  console.log("Outputs:", upRes.outputs);

}

// Entrypoint for modular Pulumi stacks
async function main() {
  const job = process.env.GITHUB_JOB;
  const projectName = getProjectName();
  switch (job) {
    case "setup-acr-infra":
      const outputs = await runStackWithEscEnv(job, projectName, "./acrStack");
      console.log("ACR Outputs:", outputs);
      break;
    case "setup-infra":
      await runStackWithEscEnv(job, projectName, "./infraStack");
      break;
    case "setup-apps":
      await runStackWithEscEnv(job, projectName, "./appsStack");
      break;
    default:
      await runStackWithEscEnv("setup-acr-infra", projectName, "./acrStack");
      await runStackWithEscEnv("setup-infra", projectName, "./infraStack");
      await runStackWithEscEnv("setup-apps", projectName, "./appsStack");
  }
}
main().catch(err => console.log(err));