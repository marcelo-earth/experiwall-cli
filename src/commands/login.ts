import { Command } from "commander";
import { input, password } from "@inquirer/prompts";
import { saveConfig, deleteConfig, loadConfig } from "../lib/config.js";
import { initClient, apiRequest } from "../lib/client.js";
import {
  printSuccess,
  printError,
  printInfo,
  printJson,
  isJsonMode,
} from "../lib/output.js";

export function registerLoginCommands(program: Command): void {
  program
    .command("login")
    .description("Save your Experiwall API key to ~/.experiwall/config.json")
    .option("--api-url <url>", "Custom API base URL (for self-hosted or staging)")
    .action(async (opts: { apiUrl?: string }) => {
      let apiKey: string;

      if (process.stdout.isTTY) {
        apiKey = await password({
          message: "Enter your secret API key (ew_sec_*):",
        });
      } else {
        apiKey = await input({ message: "Enter your secret API key:" });
      }

      apiKey = apiKey.trim();
      if (!apiKey) {
        printError("API key cannot be empty.");
        process.exit(1);
      }
      if (!apiKey.startsWith("ew_sec_")) {
        printError(
          "API key must start with 'ew_sec_'. Public keys (ew_pub_*) are for the SDK only."
        );
        process.exit(1);
      }

      printInfo("Validating API key...");
      initClient({ apiKey, baseUrl: opts.apiUrl });

      const res = await apiRequest<{ name: string; slug: string }>("/project");
      if (!res.ok) {
        if (res.status === 401) {
          printError("Invalid API key. Check the key and try again.");
        } else {
          printError(`Could not validate key: ${res.error}`);
        }
        process.exit(1);
      }

      saveConfig({ api_key: apiKey, ...(opts.apiUrl ? { api_url: opts.apiUrl } : {}) });
      printSuccess(
        `Logged in. Connected to project: ${res.data?.name ?? res.data?.slug ?? "unknown"}`
      );
    });

  program
    .command("logout")
    .description("Remove saved credentials from ~/.experiwall/config.json")
    .action(() => {
      deleteConfig();
      printSuccess("Logged out. Credentials removed.");
    });

  program
    .command("whoami")
    .description("Show the current project and API key prefix")
    .action(async () => {
      const config = loadConfig();
      const apiKey =
        process.env.EXPERIWALL_API_KEY ?? config?.api_key ?? null;

      if (!apiKey) {
        printError(
          "Not logged in. Run `experiwall login` or set EXPERIWALL_API_KEY."
        );
        process.exit(1);
      }

      initClient({
        apiKey,
        baseUrl: process.env.EXPERIWALL_API_URL ?? config?.api_url,
      });

      const res = await apiRequest<{
        name: string;
        slug: string;
        platform: string;
        id: string;
      }>("/project");
      if (!res.ok) {
        printError(`Could not fetch project info: ${res.error}`);
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson({
          project: res.data,
          api_key_prefix: apiKey.slice(0, 12) + "...",
        });
        return;
      }

      const p = res.data!;
      console.log(`Project : ${p.name} (${p.slug})`);
      console.log(`Platform: ${p.platform}`);
      console.log(`ID      : ${p.id}`);
      console.log(`API key : ${apiKey.slice(0, 12)}...`);
    });
}
