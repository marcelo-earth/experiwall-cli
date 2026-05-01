import { Command } from "commander";
import { spawn } from "node:child_process";
import { confirm, password } from "@inquirer/prompts";
import { saveConfig, deleteConfig, loadConfig } from "../lib/config.js";
import { checkApiUrl, initClient, apiRequest } from "../lib/client.js";
import {
  printSuccess,
  printError,
  printInfo,
  printJson,
  isJsonMode,
} from "../lib/output.js";

const CLI_LOGIN_URL = "https://experiwall.com/cli/login";

function openBrowser(url: string): boolean {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export function registerLoginCommands(program: Command): void {
  program
    .command("login")
    .description("Save your Experiwall API key to ~/.experiwall/config.json")
    .option("--api-key <key>", "Secret API key to save non-interactively")
    .option("--api-url <url>", "Custom API base URL (for self-hosted or staging)")
    .action(async (opts: { apiKey?: string; apiUrl?: string }) => {
      if (opts.apiUrl) {
        const check = checkApiUrl(opts.apiUrl);
        if (!check.ok) {
          printError(check.error!);
          process.exit(1);
        }
        if (!check.canonical) {
          const allow =
            process.env.EXPERIWALL_ALLOW_CUSTOM_HOST === "1" ||
            process.env.EXPERIWALL_ALLOW_CUSTOM_HOST === "true";
          if (!allow) {
            if (!process.stdout.isTTY) {
              printError(
                `Refusing to send your API key to non-canonical host '${opts.apiUrl}'. ` +
                  "Re-run interactively to confirm, or set EXPERIWALL_ALLOW_CUSTOM_HOST=1."
              );
              process.exit(1);
            }
            const ok = await confirm({
              message: `Send your API key to ${opts.apiUrl}? Only continue if you trust this host (e.g. your own self-hosted instance).`,
              default: false,
            });
            if (!ok) {
              printInfo("Cancelled.");
              process.exit(0);
            }
          }
        }
      }

      if (!opts.apiKey && !process.stdout.isTTY) {
        printError(
          "`experiwall login` requires an interactive terminal. " +
            "For non-interactive use, run `experiwall login --api-key ew_sec_...` " +
            "or set the EXPERIWALL_API_KEY environment variable."
        );
        process.exit(1);
      }

      if (!opts.apiKey) {
        const opened = openBrowser(CLI_LOGIN_URL);
        printInfo(
          opened
            ? `Opening ${CLI_LOGIN_URL} so you can generate a CLI login command.`
            : `Need an API key? Open ${CLI_LOGIN_URL}`
        );
      }

      let apiKey =
        opts.apiKey ??
        (await password({
          message: "Enter your secret API key (ew_sec_*):",
        }));

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

      const apiUrl = process.env.EXPERIWALL_API_URL ?? config?.api_url;
      if (apiUrl) {
        const check = checkApiUrl(apiUrl);
        if (!check.ok) {
          printError(check.error!);
          process.exit(1);
        }
      }
      initClient({ apiKey, baseUrl: apiUrl });

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
          api_url: apiUrl ?? null,
        });
        return;
      }

      const p = res.data!;
      console.log(`Project : ${p.name} (${p.slug})`);
      console.log(`Platform: ${p.platform}`);
      console.log(`ID      : ${p.id}`);
      console.log(`API key : ${apiKey.slice(0, 12)}...`);
      if (apiUrl) console.log(`API URL : ${apiUrl}`);
    });
}
