import chalk from "chalk";
import Table from "cli-table3";

export interface GlobalOptions {
  json?: boolean;
  noColor?: boolean;
}

let jsonMode = false;
let colorEnabled = true;

export function setOutputMode(opts: GlobalOptions): void {
  jsonMode = opts.json ?? false;
  colorEnabled = !(opts.noColor ?? false) && process.stdout.isTTY !== false;
  if (!colorEnabled) {
    chalk.level = 0;
  }
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

export function printError(msg: string): void {
  process.stderr.write(chalk.red(`Error: ${msg}`) + "\n");
}

export function printSuccess(msg: string): void {
  process.stdout.write(chalk.green(msg) + "\n");
}

export function printInfo(msg: string): void {
  process.stdout.write(chalk.dim(msg) + "\n");
}

export function printWarning(msg: string): void {
  process.stderr.write(chalk.yellow(`Warning: ${msg}`) + "\n");
}

export function makeTable(head: string[]): Table.Table {
  return new Table({
    head: head.map((h) => chalk.bold(h)),
    style: {
      head: [],
      border: colorEnabled ? ["dim"] : [],
    },
  });
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatStatus(status: string): string {
  switch (status) {
    case "active":
      return chalk.green(status);
    case "paused":
      return chalk.yellow(status);
    case "archived":
      return chalk.dim(status);
    case "completed":
      return chalk.blue(status);
    default:
      return status;
  }
}

export function formatNumber(n: number | undefined): string {
  if (n === undefined || n === null) return "-";
  return n.toLocaleString();
}

export function formatPercent(n: number | undefined): string {
  if (n === undefined || n === null) return "-";
  return `${(n * 100).toFixed(2)}%`;
}

export function formatCurrency(n: number | undefined): string {
  if (n === undefined || n === null) return "-";
  return `$${n.toFixed(2)}`;
}
