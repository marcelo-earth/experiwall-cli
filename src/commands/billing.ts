import { Command } from "commander";
import { setupClient } from "../lib/auth.js";
import { apiRequest, httpErrorMessage } from "../lib/client.js";
import {
  isJsonMode,
  printJson,
  printError,
  formatNumber,
} from "../lib/output.js";
import chalk from "chalk";

export function registerBillingCommands(program: Command): void {
  program
    .command("billing")
    .description("Show current plan, usage, and limits")
    .action(async (opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<{
        plan: string;
        status: string;
        period_end?: string;
        limits: {
          active_experiments: number;
          total_experiments: number;
          mau: number;
          events_per_month: number;
        };
        usage: {
          active_experiments: number;
          total_experiments: number;
          mau: number;
          events_this_month: number;
        };
      }>("/billing");
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const d = res.data!;
      console.log(`\nBilling\n`);
      console.log(`  Plan   : ${chalk.bold(d.plan)}`);
      console.log(`  Status : ${d.status === "active" ? chalk.green(d.status) : chalk.yellow(d.status)}`);
      if (d.period_end) {
        console.log(`  Renews : ${new Date(d.period_end).toLocaleDateString()}`);
      }

      if (d.usage && d.limits) {
        console.log(`\nUsage\n`);
        const rows: Array<[string, string, string]> = [
          [
            "Active experiments",
            formatNumber(d.usage.active_experiments),
            `/ ${formatNumber(d.limits.active_experiments)}`,
          ],
          [
            "Total experiments",
            formatNumber(d.usage.total_experiments),
            `/ ${formatNumber(d.limits.total_experiments)}`,
          ],
          [
            "Monthly active users",
            formatNumber(d.usage.mau),
            `/ ${formatNumber(d.limits.mau)}`,
          ],
          [
            "Events this month",
            formatNumber(d.usage.events_this_month),
            `/ ${formatNumber(d.limits.events_per_month)}`,
          ],
        ];
        for (const [label, used, limit] of rows) {
          console.log(`  ${label.padEnd(24)}: ${used} ${chalk.dim(limit)}`);
        }
      }
    });
}
