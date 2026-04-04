/**
 * Ágora MCP Catalog — entry point.
 *
 * Import this module to initialize the full catalog of tools,
 * resources, and prompts. The catalog is lazy-initialized on
 * first import.
 *
 * Usage:
 *   import { catalog, fetchDemographicResource, fetchBenchmarkResource } from "../_shared/mcp/index.ts";
 *   const tools = catalog.listTools("analysis");
 *   const ibge = await fetchDemographicResource("São Paulo");
 */

export { catalog } from "./registry.ts";
export type {
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  ToolParameter,
  PromptArgument,
  ToolExecutionResult,
  ResourceFetchResult,
  ResourceType,
} from "./types.ts";

import { registerTools } from "./tools.ts";
import { registerResources } from "./resources.ts";
import { registerPrompts } from "./prompts.ts";

export {
  fetchDemographicResource,
  fetchBenchmarkResource,
  fetchGenerationalResource,
} from "./resources.ts";

// ── Auto-register on import ──────────────────────────────────
let initialized = false;

export function initCatalog(): void {
  if (initialized) return;
  registerTools();
  registerResources();
  registerPrompts();
  initialized = true;
}

// Auto-init
initCatalog();
