import * as pulumi from "@pulumi/pulumi";
import * as automation from "@pulumi/pulumi/automation";
import * as fs from "fs";
import * as path from "path";

// Helper to read project name from Pulumi.yaml
function getProjectName(escEnv: String): string {
  try {
    const project = escEnv.split("/").pop();
    if (!project) {
      throw new Error("Project name not found in ESC environment");
    }
    return project;
  } catch (error) {
    console.error("Error getting project name:", error);
    throw new Error("Failed to get project name");
  }
}

// Dynamically add the ESC environment to the Pulumi config if running in CI
async function ensureEscEnvironment() {
  const escEnv = process.env.ENV_ESC;
  const stackName = process.env.PULUMI_STACK || escEnv;
  const projectName = getProjectName(escEnv);

  if (escEnv && stackName) {
    // Use Automation API to add the ESC environment to the stack config
    const stackArgs: automation.InlineProgramArgs = {
      stackName,
      projectName,
      program: async () => {}, // No-op, just managing config
    };
    const stack = await automation.LocalWorkspace.createOrSelectStack(stackArgs);
    // Add the ESC environment if not already present
    const currentEnvs = await stack.listEnvironments();
    if (!currentEnvs.includes(escEnv)) {
      await stack.addEnvironments(escEnv);
      console.log(`Added ESC environment '${escEnv}' to stack '${stackName}'.`);
    }
  }
}

// Entrypoint for modular Pulumi stacks
const job = process.env.GITHUB_JOB;

// Ensure ESC environment is set before running stack code
ensureEscEnvironment().then(() => {
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
});
