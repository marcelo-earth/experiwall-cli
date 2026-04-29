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
  formatPercent,
} from "../lib/output.js";

export function registerVisibilityCommands(program: Command): void {
  const vis = program.command("visibility").description("Manage AI visibility tracking");

  vis
    .command("get")
    .description("Get AI visibility results: mention rate, choice rate, per-query breakdown")
    .option("--days <n>", "Lookback days for historical scores (default 30)", "30")
    .action(async (opts: { days: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<{
        mention_rate: number;
        choice_rate: number;
        competitors: string[];
        queries: Array<{ query: string; mentioned: boolean; chosen: boolean; score: number }>;
        history: Array<{ date: string; mention_rate: number; choice_rate: number }>;
      }>("/visibility", { params: { days: Number(opts.days) } });

      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const d = res.data!;
      console.log(`\nAI Visibility\n`);
      console.log(`  Mention rate : ${formatPercent(d.mention_rate)}`);
      console.log(`  Choice rate  : ${formatPercent(d.choice_rate)}`);

      if (d.competitors?.length) {
        console.log(`  Competitors  : ${d.competitors.join(", ")}`);
      }

      if (d.queries?.length) {
        const table = makeTable(["QUERY", "MENTIONED", "CHOSEN", "SCORE"]);
        for (const q of d.queries) {
          table.push([
            q.query,
            q.mentioned ? "yes" : "no",
            q.chosen ? "yes" : "no",
            formatPercent(q.score),
          ]);
        }
        console.log("\nPer-query breakdown:");
        console.log(table.toString());
      }
    });

  const queries = vis.command("queries").description("Manage tracked visibility queries");

  queries
    .command("list")
    .description("List tracked AI visibility queries")
    .action(async (opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<
        Array<{ id: string; query: string; created_at: string }>
      >("/visibility/queries");
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
        printInfo("No visibility queries configured.");
        return;
      }

      const table = makeTable(["ID", "QUERY", "CREATED"]);
      for (const q of list) {
        table.push([q.id, q.query, formatDate(q.created_at)]);
      }
      console.log(table.toString());
      printInfo(`\n  ${list.length} / 10 queries`);
    });

  queries
    .command("add <query>")
    .description("Add a query to track in AI visibility scans (max 10 per project)")
    .action(async (query: string, opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest("/visibility/queries", {
        method: "POST",
        body: { query },
      });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      printSuccess(`Query added: "${query}"`);
    });

  queries
    .command("delete <id>")
    .description("Remove a tracked visibility query")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      if (!opts.yes && process.stdout.isTTY) {
        const { confirm } = await import("@inquirer/prompts");
        const ok = await confirm({
          message: `Delete visibility query ${id}?`,
          default: false,
        });
        if (!ok) {
          printInfo("Cancelled.");
          return;
        }
      }

      const res = await apiRequest(`/visibility/queries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      printSuccess("Query deleted.");
    });
}
