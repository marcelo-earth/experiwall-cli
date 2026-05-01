# @experiwall/cli

CLI for the [Experiwall](https://experiwall.com) Management API. Manage experiments, view analytics, and configure your project from the terminal or CI/CD pipelines.

## Install

Run without installing:

```sh
npx @experiwall/cli <command>
```

Or install globally:

```sh
npm install -g @experiwall/cli
```

## Authentication

The easiest way to connect the CLI is:

```sh
npx @experiwall/cli login
```

This opens the Experiwall CLI login page in your browser. Sign in, generate the CLI login command, paste it back into your terminal, and verify the connection.

```sh
npx @experiwall/cli login --api-key ew_sec_...
npx @experiwall/cli whoami
```

If you installed globally, use `experiwall` instead of `npx @experiwall/cli`.

For CI/CD, set the environment variable:

```sh
export EXPERIWALL_API_KEY=ew_sec_...
```

Priority order: `--api-key` flag > `EXPERIWALL_API_KEY` env var > `~/.experiwall/config.json`

## Commands

```sh
# Auth
experiwall login                              # Save API key
experiwall logout                             # Remove saved credentials
experiwall whoami                             # Show current project and key prefix

# Quick overview
experiwall status                             # Alias for metrics overview

# Experiments
experiwall experiments list [--status active|paused|archived|completed]
experiwall experiments create <flag_key> --variants control,treatment [--auto-optimize]
experiwall experiments get <id>
experiwall experiments update <id> [--auto-optimize true|false] [--weights '[...]']
experiwall experiments delete <id>
experiwall experiments activate <id>
experiwall experiments pause <id>
experiwall experiments archive <id>
experiwall experiments results <id> [--days 30] [--environment production]

# Short alias
ew experiments list

# Metrics
experiwall metrics overview [--days 30]
experiwall metrics timeseries [--days 90] [--experiment <id>]
experiwall metrics revenue [--days 90]

# Users
experiwall users list [--limit 50]
experiwall users growth [--days 30]

# Project
experiwall project get
experiwall project update [--name "My Project"] [--platform web|ios|android|cross_platform]

# API Keys
experiwall api-keys list
experiwall api-keys create --type public|secret
experiwall api-keys revoke <id>

# Billing
experiwall billing

# AI Visibility
experiwall visibility get [--days 30]
experiwall visibility queries list
experiwall visibility queries add "best A/B testing tools"
experiwall visibility queries delete <id>
```

## Global flags

```
--api-key <key>     Override API key for this command
--api-url <url>     Override API base URL (for staging/self-hosted)
--json              Output raw JSON (great for piping to jq)
--no-color          Disable colored output
-v, --version       Print version
-h, --help          Show help
```

## CI/CD example

```yaml
- name: Activate experiment on deploy
  env:
    EXPERIWALL_API_KEY: ${{ secrets.EXPERIWALL_API_KEY }}
  run: npx @experiwall/cli experiments activate $EXPERIMENT_ID
```

## Development

```sh
npm install
npm run build
node dist/index.js --help
```
