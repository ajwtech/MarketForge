import * as pulumi from "@pulumi/pulumi";

// Entrypoint for modular Pulumi stacks
const job = process.env.GITHUB_JOB;

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
