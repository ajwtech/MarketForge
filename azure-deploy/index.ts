import * as automation from "@pulumi/pulumi/automation";
import * as pulumi from "@pulumi/pulumi";
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


// Run the stack code inside the Automation API program so ESC config is merged
async function runStackWithEscEnv(stackName: string, projectName: string, stackModule: string) {
  const stackArgs: automation.InlineProgramArgs = {
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
  console.log(`Using stack: ${stackName} for project: ${projectName}`);
  const stack = await automation.LocalWorkspace.createOrSelectStack(stackArgs);
  console.log(`adding environment: ${projectName}/${env}`);
  await stack.addEnvironments(`${projectName}/${env}`);
  return await stack.up();
}

// Entrypoint for modular Pulumi stacks
async function main() {
  const job = process.env.PULUMI_JOB;
  let outputs: automation.OutputMap;
  switch (job) {
    case "setup-acr-infra":
      console.log("running:", "./acrStack");
      outputs = await runStackWithEscEnv(job, project, "./acrStack").then(res => res.outputs);
      console.log("ACR Infra Outputs returned to index:", outputs);
      break;
    case "setup-infra":
      console.log("running:", "./infraStack");
      outputs = await runStackWithEscEnv(job, project, "./infraStack").then(res => res.outputs);
      break;
    case "setup-apps":
      console.log("running:", "./appsStack");
      outputs = await runStackWithEscEnv(job, project, "./appsStack").then(res => res.outputs);
      break;
    case "setup-certs":
      console.log("running:", "./certsStack");
      outputs = await runStackWithEscEnv(job, project, "./certsStack").then(res => res.outputs);
      break;
    default:
      throw new Error(`Unknown job: ${job}`);
  }
  return outputs;
}
export default main().catch(err => {
  console.error(err);
  process.exit(1);
});