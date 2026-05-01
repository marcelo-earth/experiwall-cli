import { resolveApiKey, resolveApiUrl } from "./config.js";
import { checkApiUrl, initClient } from "./client.js";
import { printError } from "./output.js";

export function setupClient(flagApiKey?: string, flagApiUrl?: string): boolean {
  const apiKey = resolveApiKey(process.env.EXPERIWALL_API_KEY, flagApiKey);
  if (!apiKey) {
    printError(
      "No API key found. Run `experiwall login` or set the EXPERIWALL_API_KEY environment variable."
    );
    return false;
  }
  if (!apiKey.startsWith("ew_sec_")) {
    printError(
      "API key must be a secret key starting with 'ew_sec_'. " +
        "Public keys (ew_pub_*) are for the SDK only."
    );
    return false;
  }
  const apiUrl = resolveApiUrl(process.env.EXPERIWALL_API_URL, flagApiUrl);
  if (apiUrl) {
    const check = checkApiUrl(apiUrl);
    if (!check.ok) {
      printError(check.error!);
      return false;
    }
  }
  initClient({ apiKey, baseUrl: apiUrl });
  return true;
}
