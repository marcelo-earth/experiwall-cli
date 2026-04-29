import { Command } from "commander";
import { setupClient } from "../lib/auth.js";
import { apiRequest, httpErrorMessage } from "../lib/client.js";
import {
  isJsonMode,
  printJson,
  printError,
  printSuccess,
  formatDate,
} from "../lib/output.js";

export function registerProjectCommands(program: Command): void {
  const project = program.command("project").description("View and update project settings");

  project
    .command("get")
    .description("Get current project details")
    .action(async (opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<{
        id: string;
        name: string;
        slug: string;
        platform: string;
        bundle_id?: string;
        created_at: string;
      }>("/project");
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const p = res.data!;
      console.log(`Name      : ${p.name}`);
      console.log(`Slug      : ${p.slug}`);
      console.log(`Platform  : ${p.platform}`);
      console.log(`Bundle ID : ${p.bundle_id ?? "-"}`);
      console.log(`ID        : ${p.id}`);
      console.log(`Created   : ${formatDate(p.created_at)}`);
    });

  project
    .command("update")
    .description("Update project name, platform, or bundle ID")
    .option("--name <name>", "New project name")
    .option(
      "--platform <platform>",
      "Target platform: web | ios | android | cross_platform"
    )
    .option("--bundle-id <id>", "App bundle identifier (e.g. com.example.app)")
    .action(
      async (
        opts: { name?: string; platform?: string; bundleId?: string },
        cmd: Command
      ) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const body: Record<string, unknown> = {};
        if (opts.name !== undefined) body.name = opts.name;
        if (opts.platform !== undefined) body.platform = opts.platform;
        if (opts.bundleId !== undefined) body.bundle_id = opts.bundleId;

        if (Object.keys(body).length === 0) {
          printError("Provide at least one option: --name, --platform, or --bundle-id");
          process.exit(1);
        }

        const res = await apiRequest("/project", { method: "PATCH", body });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        printSuccess("Project updated.");
      }
    );
}
