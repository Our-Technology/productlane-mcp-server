#!/usr/bin/env node

/**
 * Productlane MCP Server
 *
 * A Model Context Protocol (MCP) server that provides AI assistants with
 * access to the Productlane customer support platform.
 *
 * Supports threads, companies, contacts, issues, projects, and changelogs
 * via the Productlane REST API (https://productlane.mintlify.dev/docs/api).
 *
 * Required env:
 *   PRODUCTLANE_API_KEY       — API key from Productlane Settings → API
 *   PRODUCTLANE_WORKSPACE_ID  — Workspace UUID from Productlane Settings
 *
 * Usage:
 *   PRODUCTLANE_API_KEY=pl_... PRODUCTLANE_WORKSPACE_ID=... npx @ourtechnology/productlane-mcp-server
 */

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const fetch = require("node-fetch");

// --- Configuration ---

const API_KEY = process.env.PRODUCTLANE_API_KEY;
const WORKSPACE_ID = process.env.PRODUCTLANE_WORKSPACE_ID;
const BASE_URL =
  process.env.PRODUCTLANE_BASE_URL || "https://productlane.com/api/v1";

if (!API_KEY) {
  console.error(
    "Error: PRODUCTLANE_API_KEY environment variable is required.\n" +
      "Get your API key from: Productlane → Settings → Integrations → API"
  );
  process.exit(1);
}
if (!WORKSPACE_ID) {
  console.error(
    "Error: PRODUCTLANE_WORKSPACE_ID environment variable is required.\n" +
      "Find your workspace ID in Productlane workspace settings."
  );
  process.exit(1);
}

// --- HTTP helpers ---

async function apiGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Productlane API ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Productlane API ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Productlane API ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${API_KEY}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Productlane API ${res.status}: ${text}`);
  }
  return res.json();
}

// --- Helper to build tool response ---

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(e) {
  return {
    content: [{ type: "text", text: `Error: ${e.message}` }],
    isError: true,
  };
}

// --- MCP Server ---

const server = new McpServer({
  name: "productlane",
  version: "0.1.0",
});

// ==================== THREADS ====================

server.tool(
  "list_threads",
  "List support threads from Productlane (Slack, email, in-app, portal conversations). Threads are the primary unit of customer communication.",
  {
    take: z
      .number()
      .max(100)
      .optional()
      .describe("Max results to return (default 100, max 100)"),
    skip: z.number().optional().describe("Pagination offset"),
    state: z
      .enum(["NEW", "PROCESSED", "COMPLETED", "SNOOZED", "UNSNOOZED"])
      .optional()
      .describe("Filter by thread state"),
    issueId: z
      .string()
      .optional()
      .describe("Filter by linked Productlane issue ID"),
    projectId: z
      .string()
      .optional()
      .describe("Filter by linked Productlane project ID"),
  },
  async ({ take, skip, state, issueId, projectId }) => {
    try {
      return ok(
        await apiGet("/threads", { take, skip, state, issueId, projectId })
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_thread",
  "Get full details for a specific thread including messages, linked issues, company, contact, tags, assignee, and pain level.",
  {
    id: z.string().describe("Thread ID"),
  },
  async ({ id }) => {
    try {
      return ok(await apiGet(`/threads/${id}`));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "create_thread",
  "Create a new support thread in Productlane.",
  {
    title: z.string().describe("Thread title"),
    text: z
      .string()
      .optional()
      .describe("Thread content (HTML formatting supported)"),
    email: z.string().optional().describe("Creator's email address"),
    actorName: z.string().optional().describe("Creator's display name"),
    painLevel: z
      .enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"])
      .optional()
      .describe("Pain level associated with this thread"),
  },
  async ({ title, text, email, actorName, painLevel }) => {
    try {
      return ok(
        await apiPost("/threads", { title, text, email, actorName, painLevel })
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "update_thread",
  "Update a thread's properties such as state or pain level.",
  {
    id: z.string().describe("Thread ID"),
    state: z
      .enum(["NEW", "PROCESSED", "COMPLETED", "SNOOZED"])
      .optional()
      .describe("New thread state"),
    painLevel: z
      .enum(["UNKNOWN", "LOW", "MEDIUM", "HIGH"])
      .optional()
      .describe("Updated pain level"),
  },
  async ({ id, state, painLevel }) => {
    try {
      const body = {};
      if (state) body.state = state;
      if (painLevel) body.painLevel = painLevel;
      return ok(await apiPatch(`/threads/${id}`, body));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "send_thread_message",
  "Send an email or Slack message within an existing thread.",
  {
    threadId: z.string().describe("Thread ID"),
    text: z.string().describe("Message content"),
    channelId: z
      .string()
      .optional()
      .describe("Slack channel ID (required for Slack-origin threads)"),
  },
  async ({ threadId, text, channelId }) => {
    try {
      const body = { text };
      if (channelId) body.channelId = channelId;
      return ok(await apiPost(`/threads/${threadId}/messages`, body));
    } catch (e) {
      return err(e);
    }
  }
);

// ==================== COMPANIES ====================

server.tool(
  "list_companies",
  "List companies tracked in Productlane. Companies are linked to contacts and threads.",
  {
    take: z.number().max(100).optional().describe("Max results (default 100)"),
    skip: z.number().optional().describe("Pagination offset"),
    name: z.string().optional().describe("Filter by company name"),
    domain: z.string().optional().describe("Filter by company domain"),
  },
  async ({ take, skip, name, domain }) => {
    try {
      return ok(await apiGet("/companies", { take, skip, name, domain }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_company",
  "Get full details for a specific company including associated threads and contacts.",
  {
    id: z.string().describe("Company ID"),
  },
  async ({ id }) => {
    try {
      return ok(await apiGet(`/companies/${id}`));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "create_company",
  "Create a new company in Productlane.",
  {
    name: z.string().describe("Company name"),
    domains: z
      .array(z.string())
      .optional()
      .describe("Company domains (e.g., ['acme.com'])"),
    autoAdd: z
      .boolean()
      .optional()
      .describe("Auto-add contacts with matching domains"),
    size: z.number().optional().describe("Company size (number of employees)"),
    revenue: z.number().optional().describe("Annual revenue"),
    externalIds: z
      .array(z.string())
      .optional()
      .describe("External system IDs"),
    tierId: z.string().optional().describe("Customer tier ID"),
    statusId: z.string().optional().describe("Customer status ID"),
  },
  async ({ name, domains, autoAdd, size, revenue, externalIds, tierId, statusId }) => {
    try {
      return ok(
        await apiPost("/companies", {
          name, domains, autoAdd, size, revenue, externalIds, tierId, statusId,
        })
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "update_company",
  "Update an existing company's properties.",
  {
    id: z.string().describe("Company ID"),
    name: z.string().optional().describe("Updated company name"),
    domains: z.array(z.string()).optional().describe("Updated domains"),
    size: z.number().optional().describe("Updated company size"),
    revenue: z.number().optional().describe("Updated annual revenue"),
  },
  async ({ id, name, domains, size, revenue }) => {
    try {
      const body = {};
      if (name) body.name = name;
      if (domains) body.domains = domains;
      if (size !== undefined) body.size = size;
      if (revenue !== undefined) body.revenue = revenue;
      return ok(await apiPatch(`/companies/${id}`, body));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_linear_options",
  "Get available Linear customer statuses and tiers configured in Productlane.",
  {},
  async () => {
    try {
      return ok(await apiGet("/companies/linear-options"));
    } catch (e) {
      return err(e);
    }
  }
);

// ==================== CONTACTS ====================

server.tool(
  "list_contacts",
  "List customer contacts in Productlane.",
  {
    take: z.number().max(100).optional().describe("Max results (default 100)"),
    skip: z.number().optional().describe("Pagination offset"),
    email: z.string().optional().describe("Filter by email address"),
    companyId: z.string().optional().describe("Filter by company ID"),
  },
  async ({ take, skip, email, companyId }) => {
    try {
      return ok(await apiGet("/contacts", { take, skip, email, companyId }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_contact",
  "Get details for a specific contact by ID or email address.",
  {
    id: z.string().describe("Contact ID or email address"),
  },
  async ({ id }) => {
    try {
      return ok(await apiGet(`/contacts/${id}`));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "create_contact",
  "Create a new contact in Productlane.",
  {
    email: z.string().describe("Contact email (required)"),
    name: z.string().optional().describe("Contact display name"),
    companyId: z.string().optional().describe("Company ID to link to"),
    companyName: z
      .string()
      .optional()
      .describe("Company name (auto-creates company if not found)"),
    companyExternalId: z
      .string()
      .optional()
      .describe("External ID for auto-created company"),
  },
  async ({ email, name, companyId, companyName, companyExternalId }) => {
    try {
      return ok(
        await apiPost("/contacts", {
          email, name, companyId, companyName, companyExternalId,
        })
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "update_contact",
  "Update an existing contact's properties.",
  {
    id: z.string().describe("Contact ID"),
    name: z.string().optional().describe("Updated name"),
    email: z.string().optional().describe("Updated email"),
    companyId: z.string().optional().describe("Link to a different company"),
  },
  async ({ id, name, email, companyId }) => {
    try {
      const body = {};
      if (name) body.name = name;
      if (email) body.email = email;
      if (companyId) body.companyId = companyId;
      return ok(await apiPatch(`/contacts/${id}`, body));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "delete_contact",
  "Delete a contact from Productlane.",
  {
    id: z.string().describe("Contact ID"),
  },
  async ({ id }) => {
    try {
      return ok(await apiDelete(`/contacts/${id}`));
    } catch (e) {
      return err(e);
    }
  }
);

// ==================== ISSUES (Portal) ====================

server.tool(
  "list_issues",
  "List issues from the Productlane portal/roadmap. These are public-facing feature requests and bugs linked from customer threads. Requires the portal to be published.",
  {
    take: z.number().max(100).optional().describe("Max results"),
    skip: z.number().optional().describe("Pagination offset"),
  },
  async ({ take, skip }) => {
    try {
      return ok(await apiGet(`/issues/${WORKSPACE_ID}`, { take, skip }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_issue",
  "Get details for a specific Productlane portal issue.",
  {
    id: z.string().describe("Issue ID"),
  },
  async ({ id }) => {
    try {
      return ok(await apiGet(`/issues/${WORKSPACE_ID}/${id}`));
    } catch (e) {
      return err(e);
    }
  }
);

// ==================== PROJECTS (Roadmap) ====================

server.tool(
  "list_projects",
  "List projects from the Productlane roadmap. Projects group related issues and may link to Linear projects via linearProjectId.",
  {
    take: z.number().max(100).optional().describe("Max results"),
    skip: z.number().optional().describe("Pagination offset"),
  },
  async ({ take, skip }) => {
    try {
      return ok(await apiGet(`/projects/${WORKSPACE_ID}`, { take, skip }));
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_project",
  "Get details for a specific Productlane roadmap project including progress, state, upvotes, importance score, and linked Linear project.",
  {
    id: z.string().describe("Project ID"),
  },
  async ({ id }) => {
    try {
      return ok(await apiGet(`/projects/${WORKSPACE_ID}/${id}`));
    } catch (e) {
      return err(e);
    }
  }
);

// ==================== CHANGELOGS ====================

server.tool(
  "list_changelogs",
  "List changelog entries for the workspace.",
  {
    take: z.number().max(100).optional().describe("Max results"),
    skip: z.number().optional().describe("Pagination offset"),
    language: z.string().optional().describe("Filter by language code"),
  },
  async ({ take, skip, language }) => {
    try {
      return ok(
        await apiGet(`/changelogs/${WORKSPACE_ID}`, { take, skip, language })
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "create_changelog",
  "Create a new changelog entry.",
  {
    title: z.string().describe("Changelog title"),
    content: z.string().describe("Changelog content (markdown supported)"),
    published: z
      .boolean()
      .optional()
      .describe("Publish immediately (default false)"),
    date: z.string().optional().describe("Date for the entry (ISO format)"),
    language: z.string().optional().describe("Language code"),
  },
  async ({ title, content, published, date, language }) => {
    try {
      return ok(
        await apiPost("/changelogs", { title, content, published, date, language })
      );
    } catch (e) {
      return err(e);
    }
  }
);

// ==================== DOCS ====================

server.tool(
  "list_articles",
  "List published documentation articles.",
  {
    take: z.number().max(100).optional().describe("Max results"),
    skip: z.number().optional().describe("Pagination offset"),
    groupId: z.string().optional().describe("Filter by article group ID"),
    language: z.string().optional().describe("Filter by language code"),
  },
  async ({ take, skip, groupId, language }) => {
    try {
      return ok(
        await apiGet(`/docs/articles/${WORKSPACE_ID}`, {
          take, skip, groupId, language,
        })
      );
    } catch (e) {
      return err(e);
    }
  }
);

server.tool(
  "get_article",
  "Get a specific published documentation article.",
  {
    id: z.string().describe("Article ID"),
  },
  async ({ id }) => {
    try {
      return ok(await apiGet(`/docs/articles/${WORKSPACE_ID}/${id}`));
    } catch (e) {
      return err(e);
    }
  }
);

// ==================== WORKSPACE ====================

server.tool(
  "get_workspace",
  "Get details about the current Productlane workspace.",
  {},
  async () => {
    try {
      return ok(await apiGet(`/workspaces/${WORKSPACE_ID}`));
    } catch (e) {
      return err(e);
    }
  }
);

// ==================== USERS ====================

server.tool(
  "list_members",
  "List all members of the Productlane workspace.",
  {},
  async () => {
    try {
      return ok(await apiGet("/users/members"));
    } catch (e) {
      return err(e);
    }
  }
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
