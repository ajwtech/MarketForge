import * as pulumi from "@pulumi/pulumi";
import { getStackRefName } from "./utils/stackRef";

const config = new pulumi.Config();

export const acr = new pulumi.StackReference(getStackRefName(config, "setup-acr-infra"));
export const infra = new pulumi.StackReference(getStackRefName(config, "setup-infra"));
