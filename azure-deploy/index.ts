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

// Dynamically add the ESC environment to the Pulumi config if running in CI
async function ensureEscEnvironment() {
  const escEnv = process.env.ENV_ESC;
  const escParts = escEnv ? escEnv.split("/") : [];
  const project = escParts.length >= 2 ? escParts[escParts.length - 2] : undefined;
  const env = escParts.length >= 1 ? escParts[escParts.length - 1] : undefined;
  const job = process.env.GITHUB_JOB;
  // Use just the job name as the stack name for Automation API
  const stackName = job;
  const projectName = getProjectName(escEnv);

  if (escEnv && stackName) {
    const envRef = project && env ? `${project}/${env}` : escEnv;
    const stackArgs: automation.InlineProgramArgs = {
      stackName,
      projectName,
      program: async () => {}, // No-op, just managing config
    };
    const stack = await automation.LocalWorkspace.createOrSelectStack(stackArgs);
    const currentEnvs = await stack.listEnvironments();
    if (!currentEnvs.includes(envRef)) {
      await stack.addEnvironments(envRef);
      console.log(`Added ESC environment '${envRef}' to stack '${stackName}'.`);
      console.log(await stack.getAllConfig().then((config) => JSON.stringify(config, null, 2)));
    }
  }
}

// Entrypoint for modular Pulumi stacks
async function main() {
  const job = process.env.GITHUB_JOB;
  await ensureEscEnvironment();
  // Debug: Print ENV_ESC and GITHUB_JOB
  console.log("[index.ts] ENV_ESC:", process.env.ENV_ESC);
  console.log("[index.ts] GITHUB_JOB:", job);
  switch (job) {
    case "setup-acr-infra":
      require("./acrStack");
      break;
    case "setup-infra":
      require("./infraStack");
      break;
    case "setup-apps":
      require("./appsStack");
      break;
    default:
      // For local/dev, run all
      require("./acrStack");
      require("./infraStack");
      require("./appsStack");
  }
}

main();
