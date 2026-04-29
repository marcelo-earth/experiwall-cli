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

interface Experiment {
  id: string;
  flag_key: string;
  status: string;
  variant_count: number;
  auto_optimize: boolean;
  created_at: string;
}

interface ExperimentDetail extends Experiment {
  variants: Array<{ id: string; key: string; weight: number; is_control: boolean }>;
  winning_variant_key?: string;
  confidence_level?: number;
}

interface ExperimentResults {
  experiment_id: string;
  total_exposures: number;
  total_conversions: number;
  total_revenue: number;
  conversion_rate: number;
  variants: Array<{
    id: string;
    key: string;
    exposures: number;
    conversions: number;
    revenue: number;
    conversion_rate: number;
    is_winner: boolean;
  }>;
  significance?: {
    z_score: number;
    confidence_level: number;
    is_significant: boolean;
  };
}

export function registerExperimentCommands(program: Command): void {
  const exp = program
    .command("experiments")
    .alias("exp")
    .description("Manage A/B experiments");

  // list
  exp
    .command("list")
    .description("List all experiments")
    .option(
      "--status <status>",
      "Filter by status: active | paused | archived | completed"
    )
    .action(async (opts: { status?: string }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<Experiment[]>("/experiments", {
        params: { status: opts.status },
      });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      const experiments = res.data ?? [];

      if (isJsonMode()) {
        printJson(experiments);
        return;
      }

      if (experiments.length === 0) {
        printInfo("No experiments found.");
        return;
      }

      const table = makeTable(["ID", "FLAG KEY", "STATUS", "VARIANTS", "CREATED"]);
      for (const e of experiments) {
        table.push([
          e.id,
          e.flag_key,
          formatStatus(e.status),
          String(e.variant_count ?? "-"),
          formatDate(e.created_at),
        ]);
      }
      console.log(table.toString());
      printInfo(`\n  ${experiments.length} experiment${experiments.length !== 1 ? "s" : ""}`);
    });

  // create
  exp
    .command("create <flag_key>")
    .description("Create a new A/B experiment")
    .requiredOption(
      "--variants <names>",
      "Comma-separated variant names (min 2, e.g. control,treatment)"
    )
    .option("--auto-optimize", "Auto-route traffic to the winning variant", false)
    .action(
      async (
        flagKey: string,
        opts: { variants: string; autoOptimize: boolean },
        cmd: Command
      ) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const variants = opts.variants.split(",").map((v) => v.trim()).filter(Boolean);
        if (variants.length < 2) {
          printError("At least 2 variants are required.");
          process.exit(1);
        }

        const res = await apiRequest("/experiments", {
          method: "POST",
          body: { flag_key: flagKey, variants, auto_optimize: opts.autoOptimize },
        });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        if (isJsonMode()) {
          printJson(res.data);
          return;
        }

        const e = res.data as ExperimentDetail;
        printSuccess(`Experiment created: ${e.flag_key} (${e.id})`);
        console.log(`  Status   : ${formatStatus(e.status)}`);
        console.log(`  Variants : ${e.variants?.map((v) => v.key).join(", ")}`);
        console.log(`  Auto-opt : ${e.auto_optimize ? "enabled" : "disabled"}`);
      }
    );

  // get
  exp
    .command("get <id>")
    .description("Get full details of an experiment")
    .action(async (id: string, opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<ExperimentDetail>(`/experiments/${id}`);
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const e = res.data!;
      console.log(`ID         : ${e.id}`);
      console.log(`Flag key   : ${e.flag_key}`);
      console.log(`Status     : ${formatStatus(e.status)}`);
      console.log(`Auto-opt   : ${e.auto_optimize ? "enabled" : "disabled"}`);
      console.log(`Created    : ${formatDate(e.created_at)}`);

      if (e.variants?.length) {
        const table = makeTable(["VARIANT", "WEIGHT", "CONTROL"]);
        for (const v of e.variants) {
          table.push([v.key, `${v.weight}%`, v.is_control ? "yes" : "no"]);
        }
        console.log("\nVariants:");
        console.log(table.toString());
      }

      if (e.winning_variant_key) {
        console.log(`\nWinner     : ${e.winning_variant_key}`);
        if (e.confidence_level !== undefined) {
          console.log(`Confidence : ${(e.confidence_level * 100).toFixed(1)}%`);
        }
      }
    });

  // update
  exp
    .command("update <id>")
    .description("Update an experiment's settings or variant weights")
    .option("--auto-optimize [bool]", "Enable/disable auto-optimization (true|false)")
    .option("--weights <json>", "Variant weights as JSON: '[{\"id\":\"...\",\"weight\":50}]'")
    .action(
      async (
        id: string,
        opts: { autoOptimize?: string; weights?: string },
        cmd: Command
      ) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const body: Record<string, unknown> = {};

        if (opts.autoOptimize !== undefined) {
          body.auto_optimize = opts.autoOptimize !== "false";
        }
        if (opts.weights !== undefined) {
          try {
            body.variants = JSON.parse(opts.weights);
          } catch {
            printError("--weights must be valid JSON. Example: '[{\"id\":\"...\",\"weight\":50}]'");
            process.exit(1);
          }
        }

        if (Object.keys(body).length === 0) {
          printError("Provide at least one option to update: --auto-optimize or --weights");
          process.exit(1);
        }

        const res = await apiRequest(`/experiments/${id}`, { method: "PATCH", body });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        printSuccess("Experiment updated.");
      }
    );

  // delete
  exp
    .command("delete <id>")
    .description("Permanently delete an experiment (cannot be undone)")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      if (!opts.yes && process.stdout.isTTY) {
        const { confirm } = await import("@inquirer/prompts");
        const ok = await confirm({
          message: `Delete experiment ${id}? This cannot be undone.`,
          default: false,
        });
        if (!ok) {
          printInfo("Cancelled.");
          return;
        }
      }

      const res = await apiRequest(`/experiments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      printSuccess("Experiment deleted.");
    });

  // lifecycle: activate / pause / archive
  for (const action of ["activate", "pause", "archive"] as const) {
    const pastTense = action === "pause" ? "paused" : `${action}d`;
    exp
      .command(`${action} <id>`)
      .description(`Set experiment status to '${action === "activate" ? "active" : pastTense}'`)
      .action(async (id: string, opts: unknown, cmd: Command) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const res = await apiRequest(`/experiments/${id}/${action}`, { method: "POST" });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        printSuccess(`Experiment ${pastTense}.`);
      });
  }

  // results
  exp
    .command("results <id>")
    .description("Get conversion metrics and statistical significance for an experiment")
    .option("--days <n>", "Lookback period in days (default 30, max 90)", "30")
    .option("--environment <env>", "Environment: production | development", "production")
    .action(
      async (
        id: string,
        opts: { days: string; environment: string },
        cmd: Command
      ) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const res = await apiRequest<ExperimentResults>(
          `/experiments/${id}/results`,
          { params: { days: Number(opts.days), environment: opts.environment } }
        );
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        if (isJsonMode()) {
          printJson(res.data);
          return;
        }

        const r = res.data!;
        console.log(`\nExperiment results (last ${opts.days} days, ${opts.environment})\n`);
        console.log(`  Total exposures : ${r.total_exposures?.toLocaleString() ?? "-"}`);
        console.log(`  Total converts  : ${r.total_conversions?.toLocaleString() ?? "-"}`);
        console.log(`  Conversion rate : ${r.conversion_rate !== undefined ? `${(r.conversion_rate * 100).toFixed(2)}%` : "-"}`);
        console.log(`  Revenue         : $${r.total_revenue?.toFixed(2) ?? "-"}`);

        if (r.variants?.length) {
          const table = makeTable(["VARIANT", "EXPOSURES", "CONVERSIONS", "CVR", "REVENUE", "WINNER"]);
          for (const v of r.variants) {
            table.push([
              v.key,
              v.exposures?.toLocaleString() ?? "-",
              v.conversions?.toLocaleString() ?? "-",
              v.conversion_rate !== undefined ? `${(v.conversion_rate * 100).toFixed(2)}%` : "-",
              `$${v.revenue?.toFixed(2) ?? "-"}`,
              v.is_winner ? "✓" : "",
            ]);
          }
          console.log("\nBy variant:");
          console.log(table.toString());
        }

        if (r.significance) {
          const s = r.significance;
          console.log(
            `\nSignificance: z=${s.z_score?.toFixed(3) ?? "-"}, ` +
              `confidence=${s.confidence_level !== undefined ? `${(s.confidence_level * 100).toFixed(1)}%` : "-"}, ` +
              `significant=${s.is_significant ? "yes" : "no"}`
          );
        }
      }
    );
}
