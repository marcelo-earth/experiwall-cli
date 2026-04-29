import { Command } from "commander";
import { setupClient } from "../lib/auth.js";
import { apiRequest, httpErrorMessage } from "../lib/client.js";
import {
  isJsonMode,
  printJson,
  printError,
  makeTable,
  formatNumber,
  formatPercent,
  formatCurrency,
  formatDate,
} from "../lib/output.js";

export function registerMetricsCommands(program: Command): void {
  const metrics = program.command("metrics").description("View analytics and metrics");

  // overview
  metrics
    .command("overview")
    .description("High-level summary: users, exposures, conversions, revenue")
    .option("--days <n>", "Lookback period in days (default 30, max 90)", "30")
    .option("--environment <env>", "Environment: production | development", "production")
    .action(async (opts: { days: string; environment: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<{
        active_experiments: number;
        total_users: number;
        total_exposures: number;
        total_conversions: number;
        conversion_rate: number;
        total_revenue: number;
      }>("/metrics/overview", {
        params: { days: Number(opts.days), environment: opts.environment },
      });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const d = res.data!;
      console.log(`\nOverview — last ${opts.days} days (${opts.environment})\n`);
      console.log(`  Active experiments : ${formatNumber(d.active_experiments)}`);
      console.log(`  Total users        : ${formatNumber(d.total_users)}`);
      console.log(`  Exposures          : ${formatNumber(d.total_exposures)}`);
      console.log(`  Conversions        : ${formatNumber(d.total_conversions)}`);
      console.log(`  Conversion rate    : ${formatPercent(d.conversion_rate)}`);
      console.log(`  Revenue            : ${formatCurrency(d.total_revenue)}`);
    });

  // timeseries
  metrics
    .command("timeseries")
    .description("Daily exposures, conversions, and revenue over time")
    .option("--days <n>", "Lookback period in days (default 90, max 90)", "90")
    .option("--environment <env>", "Environment: production | development", "production")
    .option("--experiment <id>", "Filter to a specific experiment ID")
    .action(
      async (
        opts: { days: string; environment: string; experiment?: string },
        cmd: Command
      ) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const res = await apiRequest<
          Array<{ date: string; exposures: number; conversions: number; revenue: number }>
        >("/metrics/timeseries", {
          params: {
            days: Number(opts.days),
            environment: opts.environment,
            experiment_id: opts.experiment,
          },
        });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        const rows = res.data ?? [];

        if (isJsonMode()) {
          printJson(rows);
          return;
        }

        const table = makeTable(["DATE", "EXPOSURES", "CONVERSIONS", "REVENUE"]);
        for (const row of rows) {
          table.push([
            formatDate(row.date),
            formatNumber(row.exposures),
            formatNumber(row.conversions),
            formatCurrency(row.revenue),
          ]);
        }
        console.log(table.toString());
      }
    );

  // revenue
  metrics
    .command("revenue")
    .description("Total revenue and daily breakdown")
    .option("--days <n>", "Lookback period in days (default 90, max 90)", "90")
    .action(async (opts: { days: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<{
        total_revenue: number;
        daily: Array<{ date: string; revenue: number; purchases: number; renewals: number }>;
      }>("/metrics/revenue", {
        params: { days: Number(opts.days) },
      });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const d = res.data!;
      console.log(`\nRevenue — last ${opts.days} days\n`);
      console.log(`  Total: ${formatCurrency(d.total_revenue)}\n`);

      if (d.daily?.length) {
        const table = makeTable(["DATE", "REVENUE", "PURCHASES", "RENEWALS"]);
        for (const row of d.daily) {
          table.push([
            formatDate(row.date),
            formatCurrency(row.revenue),
            formatNumber(row.purchases),
            formatNumber(row.renewals),
          ]);
        }
        console.log(table.toString());
      }
    });
}
