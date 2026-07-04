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
} from "../lib/output.js";

function fmtPrice(price: number, currency: string): string {
  return `${currency} ${price.toFixed(2)}`;
}

interface Product {
  id: string;
  name: string;
  store: string;
  store_product_id: string;
  type: string;
  price: number;
  currency: string;
  period: string | null;
  trial_days: number;
  created_at: string;
}

export function registerProductsCommands(program: Command): void {
  const products = program
    .command("products")
    .alias("prod")
    .description("Manage subscription products");

  // list
  products
    .command("list")
    .description("List all products")
    .action(async (opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<Product[]>("/products");
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
        printInfo("No products found.");
        return;
      }

      const table = makeTable(["ID", "NAME", "STORE", "TYPE", "PRICE", "PERIOD"]);
      for (const p of list) {
        table.push([
          p.id,
          p.name,
          p.store.replace("_", " "),
          p.type.replace("_", " "),
          fmtPrice(p.price, p.currency),
          p.period ?? "-",
        ]);
      }
      console.log(table.toString());
      printInfo(`\n  ${list.length} product${list.length !== 1 ? "s" : ""}`);
    });

  // get
  products
    .command("get <id>")
    .description("Get details of a product")
    .action(async (id: string, opts: unknown, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      const res = await apiRequest<Product>(`/products/${encodeURIComponent(id)}`);
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      if (isJsonMode()) {
        printJson(res.data);
        return;
      }

      const p = res.data!;
      console.log(`ID               : ${p.id}`);
      console.log(`Name             : ${p.name}`);
      console.log(`Store            : ${p.store.replace("_", " ")}`);
      console.log(`Store product ID : ${p.store_product_id}`);
      console.log(`Type             : ${p.type.replace("_", " ")}`);
      console.log(`Price            : ${fmtPrice(p.price, p.currency)}`);
      if (p.period) console.log(`Period           : ${p.period}`);
      if (p.trial_days) console.log(`Trial days       : ${p.trial_days}`);
      console.log(`Created          : ${formatDate(p.created_at)}`);
    });

  // create
  products
    .command("create")
    .description("Create a new product")
    .requiredOption("--name <name>", "Display name")
    .requiredOption("--store <store>", "Store: app_store | play_store | stripe")
    .requiredOption("--sku <id>", "Store product ID / SKU")
    .requiredOption("--type <type>", "Type: consumable | non_consumable | subscription")
    .requiredOption("--price <amount>", "Price as a decimal (e.g. 9.99)")
    .requiredOption("--currency <code>", "3-letter ISO currency code (e.g. USD)")
    .option("--period <period>", "Billing period (e.g. monthly, annual, P1M)")
    .option("--trial-days <n>", "Free trial days", "0")
    .action(
      async (
        opts: {
          name: string;
          store: string;
          sku: string;
          type: string;
          price: string;
          currency: string;
          period?: string;
          trialDays: string;
        },
        cmd: Command
      ) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const price = parseFloat(opts.price);
        if (isNaN(price) || price < 0) {
          printError("--price must be a non-negative number (e.g. 9.99)");
          process.exit(1);
        }

        const res = await apiRequest("/products", {
          method: "POST",
          body: {
            name: opts.name,
            store: opts.store,
            store_product_id: opts.sku,
            type: opts.type,
            price,
            currency: opts.currency,
            period: opts.period ?? null,
            trial_days: parseInt(opts.trialDays) || 0,
          },
        });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        if (isJsonMode()) {
          printJson(res.data);
          return;
        }

        const p = res.data as Product;
        printSuccess(`Product created: ${p.name} (${p.id})`);
        console.log(`  Store : ${p.store.replace("_", " ")} — ${p.store_product_id}`);
        console.log(`  Price : ${fmtPrice(p.price, p.currency)}${p.period ? ` / ${p.period}` : ""}`);
      }
    );

  // update
  products
    .command("update <id>")
    .description("Update a product")
    .option("--name <name>", "New display name")
    .option("--store <store>", "Store: app_store | play_store | stripe")
    .option("--sku <id>", "Store product ID / SKU")
    .option("--type <type>", "Type: consumable | non_consumable | subscription")
    .option("--price <amount>", "New price as a decimal")
    .option("--currency <code>", "3-letter ISO currency code")
    .option("--period <period>", "Billing period")
    .option("--trial-days <n>", "Free trial days")
    .action(
      async (
        id: string,
        opts: {
          name?: string;
          store?: string;
          sku?: string;
          type?: string;
          price?: string;
          currency?: string;
          period?: string;
          trialDays?: string;
        },
        cmd: Command
      ) => {
        const globals = cmd.optsWithGlobals();
        if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

        const body: Record<string, unknown> = {};
        if (opts.name) body.name = opts.name;
        if (opts.store) body.store = opts.store;
        if (opts.sku) body.store_product_id = opts.sku;
        if (opts.type) body.type = opts.type;
        if (opts.price !== undefined) {
          const price = parseFloat(opts.price);
          if (isNaN(price) || price < 0) {
            printError("--price must be a non-negative number");
            process.exit(1);
          }
          body.price = price;
        }
        if (opts.currency) body.currency = opts.currency;
        if (opts.period !== undefined) body.period = opts.period || null;
        if (opts.trialDays !== undefined) body.trial_days = parseInt(opts.trialDays) || 0;

        if (Object.keys(body).length === 0) {
          printError("Provide at least one option to update.");
          process.exit(1);
        }

        const res = await apiRequest(`/products/${encodeURIComponent(id)}`, { method: "PATCH", body });
        if (!res.ok) {
          printError(httpErrorMessage(res));
          process.exit(1);
        }

        printSuccess("Product updated.");
      }
    );

  // delete
  products
    .command("delete <id>")
    .description("Delete a product")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(async (id: string, opts: { yes?: boolean }, cmd: Command) => {
      const globals = cmd.optsWithGlobals();
      if (!setupClient(globals.apiKey, globals.apiUrl)) process.exit(1);

      if (!opts.yes && process.stdout.isTTY) {
        const { confirm } = await import("@inquirer/prompts");
        const ok = await confirm({
          message: `Delete product ${id}? This cannot be undone.`,
          default: false,
        });
        if (!ok) {
          printInfo("Cancelled.");
          return;
        }
      }

      const res = await apiRequest(`/products/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        printError(httpErrorMessage(res));
        process.exit(1);
      }

      printSuccess("Product deleted.");
    });
}
