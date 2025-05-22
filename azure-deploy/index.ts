import * as pulumi from "@pulumi/pulumi";
import * as automation from "@pulumi/pulumi/automation";
import * as fs from "fs";
import * as path from "path";

// Helper to read project name from Pulumi.yaml
function getProjectName(escEnv: string | undefined): string {
  if (!escEnv) {
    throw new Error("ESC environment is undefined");
  }
  const project = escEnv.split("/").pop();
  if (!project) {
    throw new Error("Project name not found in ESC environment");
  }
  return project;
}

// Run the stack code inside the Automation API program so ESC config is merged
async function runStackWithEscEnv(stackName: string, projectName: string, stackModule: string) {
  const escEnv = process.env.ENV_ESC;
  const escParts = escEnv ? escEnv.split("/") : [];
  const project = escParts.length >= 2 ? escParts[escParts.length - 2] : undefined;
  const env = escParts.length >= 1 ? escParts[escParts.length - 1] : undefined;
  const envRef = project && env ? `${project}/${env}` : escEnv || "";
  const stackArgs: automation.InlineProgramArgs = {
    stackName,
    projectName,
    program: async () => {
      require(stackModule);
    },
  };
  const stack = await automation.LocalWorkspace.createOrSelectStack(stackArgs);
  await stack.refresh();
  const currentEnvs = await stack.listEnvironments();
  if (envRef && !currentEnvs.includes(envRef)) {
    await stack.addEnvironments(envRef);
    console.log(`Added ESC environment '${envRef}' to stack '${stackName}'.`);
  }

  await stack.up({ onOutput: (msg) => process.stdout.write("[pulumi] " + msg) });
}

// Entrypoint for modular Pulumi stacks
async function main() {
  const job = process.env.GITHUB_JOB;
  const escEnv = process.env.ENV_ESC;
  const projectName = getProjectName(escEnv);
  switch (job) {
    case "setup-acr-infra":
      await runStackWithEscEnv(job, projectName, "./acrStack");
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

main();
