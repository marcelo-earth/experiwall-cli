import { Command } from "commander";
import { setupClient } from "../lib/auth.js";
import { apiRequest, httpErrorMessage } from "../lib/client.js";
import {
  isJsonMode,
  printJson,
  printError,
  printSuccess,
} from "../lib/output.js";

export function registerOrgCommands(program: Command): void {
  const org = program.command("org").description("Manage organizations");

  org
    .command("create")
    .description(
      "Create a new organization, bootstrapped with a first project and a fresh secret key"
    )
    .argument("<name>", "Organization name")
    .option("--project-name <name>", "First project name (defaults to the org name)")
    .option(
      "--platform <platform>",
      "Platform for the first project: web | ios | android | cross_platform",
      "web"
    )
    .action(
      async (
        name: string,
        opts: { projectName?: string; platform?: string },
        cmd: Command
      ) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const body: Record<string, unknown> = { name };
        if (opts.projectName !== undefined) body.project_name = opts.projectName;
        if (opts.platform !== undefined) body.platform = opts.platform;

        const res = await apiRequest<{
          organization: { id: string; name: string };
          project: { id: string; name: string; slug: string; platform: string };
          secret_key: string;
        }>("/organizations", { method: "POST", body });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        if (isJsonMode()) {
          printJson(res.data);
          return;
        }

        const d = res.data!;
        printSuccess(`Organization "${d.organization.name}" created.`);
        console.log(`Org ID      : ${d.organization.id}`);
        console.log(`Project     : ${d.project.name} (${d.project.id})`);
        console.log(`Platform    : ${d.project.platform}`);
        console.log("");
        console.log("Secret key for the new project (shown once, save it now):");
        console.log(`  ${d.secret_key}`);
        console.log("");
        console.log(
          "Use it with: experiwall <command> --api-key <key>, or run `experiwall login --api-key <key>`."
        );
      }
    );
}
