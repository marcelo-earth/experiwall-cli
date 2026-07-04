import { readFileSync } from "node:fs";
import { Command } from "commander";
import { setupClient } from "../lib/auth.js";
import { apiRequest, httpErrorMessage } from "../lib/client.js";
import {
  isJsonMode,
  printJson,
  printError,
  printSuccess,
  printInfo,
  makeTable,
  formatDate,
  formatStatus,
} from "../lib/output.js";

interface Screen {
  id: string;
  name: string;
  published: boolean;
  published_at: string | null;
  updated_at: string;
  created_at: string;
}

interface ScreenDetail extends Screen {
  config: unknown;
  published_config: unknown;
}

export function registerScreensCommands(program: Command): void {
  const screens = program
    .command("screens")
    .alias("sc")
    .description("Manage paywall screens");

  // list
  screens
    .command("list")
    .description("List all paywall screens")
    .action(async (opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<Screen[]>("/screens");
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      const list = res.data ?? [];

      if (isJsonMode()) {
        printJson(list);
        return;
      }

      if (list.length === 0) {
        printInfo("No screens found.");
        return;
      }

      const table = makeTable(["ID", "NAME", "STATUS", "UPDATED"]);
      for (const s of list) {
        table.push([
          s.id,
          s.name,
          formatStatus(s.published ? "published" : "draft"),
          formatDate(s.updated_at),
        ]);
      }
      console.log(table.toString());
      printInfo(`\n  ${list.length} screen${list.length !== 1 ? "s" : ""}`);
    });

  // get
  screens
    .command("get <id>")
    .description("Get full details and config of a screen")
    .action(async (id: string, opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<ScreenDetail>(`/screens/${encodeURIComponent(id)}`);
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const s = res.data!;
      console.log(`ID         : ${s.id}`);
      console.log(`Name       : ${s.name}`);
      console.log(`Status     : ${formatStatus(s.published ? "published" : "draft")}`);
      if (s.published_at) console.log(`Published  : ${formatDate(s.published_at)}`);
      console.log(`Updated    : ${formatDate(s.updated_at)}`);
      console.log(`Created    : ${formatDate(s.created_at)}`);
      console.log(`\nConfig     : (use --json to export the full ComponentNode tree)`);
    });

  // update
  screens
    .command("update <id>")
    .description("Update a screen's name and/or design config (the ComponentNode tree)")
    .option("--name <name>", "New screen name")
    .option(
      "--config <file>",
      "Path to a JSON file with the full ScreenConfig envelope ({ version, tree, ... }). Use '-' to read from stdin."
    )
    .action(
      async (id: string, opts: { name?: string; config?: string }, cmd: Command) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const body: Record<string, unknown> = {};

        if (opts.name) body.name = opts.name;

        if (opts.config) {
          let raw: string;
          try {
            raw = readFileSync(opts.config === "-" ? 0 : opts.config, "utf8");
          } catch (err) {
            printError(
              `Could not read config file "${opts.config}": ${err instanceof Error ? err.message : String(err)}`
            );
            process.exit(1);
          }
          try {
            body.config = JSON.parse(raw);
          } catch (err) {
            printError(`Config file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
          }
        }

        if (Object.keys(body).length === 0) {
          printError("Provide at least one of --name or --config.");
          process.exit(1);
        }

        const res = await apiRequest(`/screens/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body,
        });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        if (isJsonMode()) {
          printJson(res.data);
          return;
        }

        printSuccess("Screen updated. Run 'experiwall screens publish <id>' to make it live.");
      }
    );

  // publish
  screens
    .command("publish <id>")
    .description("Publish the current draft of a screen (makes it live)")
    .action(async (id: string, opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest(`/screens/${encodeURIComponent(id)}/publish`, { method: "POST" });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      printSuccess(`Screen published.`);
    });

  // duplicate
  screens
    .command("duplicate <id>")
    .description("Duplicate a screen (copies draft config, does not publish)")
    .option("--name <name>", "Name for the new screen (default: '<original> (copy)')")
    .action(async (id: string, opts: { name?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<Screen>(`/screens/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        body: opts.name ? { name: opts.name } : {},
      });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const s = res.data!;
      printSuccess(`Screen duplicated: ${s.name} (${s.id})`);
    });
}
