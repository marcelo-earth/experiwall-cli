import { Command } from "commander";
import { setupClient } from "../lib/auth.js";
import { apiRequest, httpErrorMessage } from "../lib/client.js";
import {
  isJsonMode,
  printJson,
  printError,
  printInfo,
  makeTable,
  formatDate,
  formatNumber,
} from "../lib/output.js";

export function registerUsersCommands(program: Command): void {
  const users = program.command("users").description("View app users");

  users
    .command("list")
    .description("List tracked users")
    .option("--limit <n>", "Number of users to return (max 100)", "50")
    .option("--offset <n>", "Pagination offset", "0")
    .action(async (opts: { limit: string; offset: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<{
        data: Array<{ id: string; alias_id: string; subscription_status: string; created_at: string }>;
        total: number;
        limit: number;
        offset: number;
      }>("/users", { params: { limit: Number(opts.limit), offset: Number(opts.offset) } });

      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const d = res.data!;
      const rows = d.data ?? [];

      if (rows.length === 0) {
        printInfo("No users found.");
        return;
      }

      const table = makeTable(["ID", "ALIAS", "SUBSCRIPTION", "CREATED"]);
      for (const u of rows) {
        table.push([u.id, u.alias_id ?? "-", u.subscription_status ?? "-", formatDate(u.created_at)]);
      }
      console.log(table.toString());
      printInfo(`\n  ${rows.length} of ${formatNumber(d.total)} users`);
    });

  users
    .command("growth")
    .description("Daily new-user counts over time")
    .option("--days <n>", "Lookback period in days (default 30, max 90)", "30")
    .action(async (opts: { days: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<Array<{ date: string; new_users: number }>>(
        "/users/growth",
        { params: { days: Number(opts.days) } }
      );
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      const rows = res.data ?? [];

      if (isJsonMode()) {
        printJson(rows);
        return;
      }

      const table = makeTable(["DATE", "NEW USERS"]);
      for (const row of rows) {
        table.push([formatDate(row.date), formatNumber(row.new_users)]);
      }
      console.log(table.toString());
    });
}
