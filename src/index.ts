#!/usr/bin/env node

import { Command } from "commander";
import { createRequire } from "node:module";
import { setOutputMode } from "./lib/output.js";
import { registerLoginCommands } from "./commands/login.js";
import { registerExperimentCommands } from "./commands/experiments.js";
import { registerMetricsCommands } from "./commands/metrics.js";
import { registerUsersCommands } from "./commands/users.js";
import { registerProjectCommands } from "./commands/project.js";
import { registerApiKeysCommands } from "./commands/api-keys.js";
import { registerBillingCommands } from "./commands/billing.js";
import { registerVisibilityCommands } from "./commands/visibility.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string; name: string };

// Async update check — never slows the current command
async function checkForUpdates(): Promise<void> {
  try {
    const { default: updateNotifier } = await import("update-notifier");
    const notifier = updateNotifier({ pkg, updateCheckInterval: 1000 * 60 * 60 * 12 });
    notifier.notify();
  } catch {
    // update-notifier is optional — don't crash if it fails
  }
}

const program = new Command();

program
  .name("experiwall")
  .description("CLI for the Experiwall Management API")
  .version(pkg.version, "-v, --version")
  .option("--api-key <key>", "Override API key for this command")
  .option("--api-url <url>", "Override API base URL")
  .option("--json", "Output raw JSON instead of formatted tables")
  .option("--no-color", "Disable colored output")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.optsWithGlobals();
    setOutputMode({ json: opts.json, noColor: opts.noColor === false || opts.noColor });
  });

// Register all command groups
registerLoginCommands(program);
registerExperimentCommands(program);
registerMetricsCommands(program);
registerUsersCommands(program);
registerProjectCommands(program);
registerApiKeysCommands(program);
registerBillingCommands(program);
registerVisibilityCommands(program);

// Alias: `experiwall status` -> `experiwall metrics overview`
program
  .command("status")
  .description("Quick overview (alias for metrics overview)")
  .option("--days <n>", "Lookback period in days", "30")
  .option("--environment <env>", "Environment: production | development", "production")
  .action(async (opts: { days: string; environment: string }, cmd: Command) => {
    const globals = cmd.optsWithGlobals();
    const args = ["metrics", "overview", "--days", opts.days, "--environment", opts.environment];
    if (globals.json) args.push("--json");
    if (globals.apiKey) args.push("--api-key", globals.apiKey);
    if (globals.apiUrl) args.push("--api-url", globals.apiUrl);
    await program.parseAsync(args, { from: "user" });
  });

void checkForUpdates();
program.parseAsync(process.argv).catch((err: Error) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
