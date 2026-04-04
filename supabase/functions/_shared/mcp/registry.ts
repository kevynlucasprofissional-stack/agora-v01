/**
 * Central registry for Ágora's MCP-ready catalog.
 *
 * Provides a singleton catalog of tools, resources, and prompts
 * that can be queried at runtime. This is the foundation for
 * future MCP server exposure.
 */

import type { ToolDefinition, ResourceDefinition, PromptDefinition } from "./types.ts";

class AgoraCatalog {
  private tools = new Map<string, ToolDefinition>();
  private resources = new Map<string, ResourceDefinition>();
  private prompts = new Map<string, PromptDefinition>();

  // ── Tools ────────────────────────────────────────────────

  registerTool(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  listTools(category?: ToolDefinition["category"]): ToolDefinition[] {
    const all = Array.from(this.tools.values());
    return category ? all.filter((t) => t.category === category) : all;
  }

  // ── Resources ────────────────────────────────────────────

  registerResource(resource: ResourceDefinition): void {
    this.resources.set(resource.uri, resource);
  }

  getResource(uri: string): ResourceDefinition | undefined {
    return this.resources.get(uri);
  }

  listResources(type?: ResourceDefinition["type"]): ResourceDefinition[] {
    const all = Array.from(this.resources.values());
    return type ? all.filter((r) => r.type === type) : all;
  }

  // ── Prompts ──────────────────────────────────────────────

  registerPrompt(prompt: PromptDefinition): void {
    this.prompts.set(prompt.name, prompt);
  }

  getPrompt(name: string): PromptDefinition | undefined {
    return this.prompts.get(name);
  }

  listPrompts(agentKind?: string): PromptDefinition[] {
    const all = Array.from(this.prompts.values());
    return agentKind ? all.filter((p) => p.agentKind === agentKind) : all;
  }

  // ── Introspection ────────────────────────────────────────

  /** Summary for debugging / future MCP server info */
  summary() {
    return {
      tools: this.tools.size,
      resources: this.resources.size,
      prompts: this.prompts.size,
      toolNames: Array.from(this.tools.keys()),
      resourceUris: Array.from(this.resources.keys()),
      promptNames: Array.from(this.prompts.keys()),
    };
  }
}

/** Singleton catalog instance */
export const catalog = new AgoraCatalog();
