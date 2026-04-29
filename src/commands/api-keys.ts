import { Command } from "commander";
import { setupClient } from "../lib/auth.js";
import { apiRequest, httpErrorMessage } from "../lib/client.js";
import {
  isJsonMode,
  printJson,
  printError,
  printSuccess,
  printInfo,
  printWarning,
  makeTable,
  formatDate,
} from "../lib/output.js";
import chalk from "chalk";

interface ApiKey {
  id: string;
  key_type: "public" | "secret";
  key_prefix: string;
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
}

export function registerApiKeysCommands(program: Command): void {
  const keys = program.command("api-keys").description("Manage API keys");

  keys
    .command("list")
    .description("List all API keys for this project")
    .action(async (opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<ApiKey[]>("/api-keys");
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      const keys = res.data ?? [];

      if (isJsonMode()) {
        printJson(keys);
        return;
      }

      if (keys.length === 0) {
        printInfo("No API keys found.");
        return;
      }

      const table = makeTable(["ID", "TYPE", "PREFIX", "CREATED", "LAST USED", "STATUS"]);
      for (const k of keys) {
        table.push([
          k.id,
          k.key_type,
          k.key_prefix + "...",
          formatDate(k.created_at),
          formatDate(k.last_used_at),
          k.revoked_at ? chalk.red("revoked") : chalk.green("active"),
        ]);
      }
      console.log(table.toString());
    });

  keys
    .command("create")
    .description("Create a new API key")
    .requiredOption("--type <type>", "Key type: public | secret")
    .action(async (opts: { type: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      if (opts.type !== "public" && opts.type !== "secret") {
        printError("--type must be 'public' or 'secret'");
        process.exit(1);
      }

      const res = await apiRequest<{ id: string; key: string; key_type: string }>("/api-keys", {
        method: "POST",
        body: { key_type: opts.type },
      });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const k = res.data!;
      printSuccess("API key created. Save it now — it will not be shown again.");
      console.log(`\n  ${chalk.bold(k.key)}\n`);
      printWarning("Store this key securely. It cannot be recovered.");
    });

  keys
    .command("revoke <id>")
    .description("Revoke an API key permanently")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      if (!opts.yes && process.stdout.isTTY) {
        const { confirm } = await import("@inquirer/prompts");
        const ok = await confirm({
          message: `Revoke API key ${id}? This cannot be undone.`,
          default: false,
        });
        if (!ok) {
          printInfo("Cancelled.");
          return;
        }
      }

      const res = await apiRequest(`/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      printSuccess("API key revoked.");
    });
}
