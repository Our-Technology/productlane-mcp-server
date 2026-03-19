# Productlane MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [Productlane](https://productlane.com) customer support platform. Gives AI assistants like Claude, Cursor, and Copilot access to your Productlane threads, companies, contacts, issues, projects, changelogs, and docs.

## Tools

| Tool | Description |
|------|-------------|
| `list_threads` | List support threads (Slack, email, in-app, portal) with state/issue/project filtering |
| `get_thread` | Get full thread details including messages, company, contact, tags, pain level |
| `create_thread` | Create a new support thread |
| `update_thread` | Update thread state or pain level |
| `send_thread_message` | Send an email or Slack message within a thread |
| `list_companies` | List companies with name/domain filtering |
| `get_company` | Get company details with linked threads and contacts |
| `create_company` | Create a new company |
| `update_company` | Update company properties |
| `get_linear_options` | Get Linear customer statuses and tiers |
| `list_contacts` | List contacts with email/company filtering |
| `get_contact` | Get contact by ID or email |
| `create_contact` | Create a new contact |
| `update_contact` | Update contact properties |
| `delete_contact` | Delete a contact |
| `list_issues` | List portal/roadmap issues |
| `get_issue` | Get issue details |
| `list_projects` | List roadmap projects (includes Linear project links) |
| `get_project` | Get project details with progress, upvotes, importance score |
| `list_changelogs` | List changelog entries |
| `create_changelog` | Create a changelog entry (markdown supported) |
| `list_articles` | List published documentation articles |
| `get_article` | Get a documentation article |
| `get_workspace` | Get workspace details |
| `list_members` | List workspace members |

## Setup

### 1. Get your credentials

- **API Key**: Productlane → Settings → Integrations → API
- **Workspace ID**: Your workspace UUID from Productlane settings

### 2. Configure your MCP client

#### Claude Desktop / Cowork

Add to your MCP config:

```json
{
  "mcpServers": {
    "productlane": {
      "command": "npx",
      "args": ["-y", "productlane-mcp-server"],
      "env": {
        "PRODUCTLANE_API_KEY": "pl_your_api_key",
        "PRODUCTLANE_WORKSPACE_ID": "your-workspace-uuid"
      }
    }
  }
}
```

#### Cursor / Windsurf

Add to `.cursor/mcp.json` or your editor's MCP config:

```json
{
  "mcpServers": {
    "productlane": {
      "command": "npx",
      "args": ["-y", "productlane-mcp-server"],
      "env": {
        "PRODUCTLANE_API_KEY": "pl_your_api_key",
        "PRODUCTLANE_WORKSPACE_ID": "your-workspace-uuid"
      }
    }
  }
}
```

#### Local development

```bash
git clone https://github.com/our-technology/productlane-mcp-server.git
cd productlane-mcp-server
npm install
PRODUCTLANE_API_KEY=pl_... PRODUCTLANE_WORKSPACE_ID=... npm start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PRODUCTLANE_API_KEY` | Yes | API key from Productlane settings |
| `PRODUCTLANE_WORKSPACE_ID` | Yes | Workspace UUID |
| `PRODUCTLANE_BASE_URL` | No | Override API base URL (default: `https://productlane.com/api/v1`) |

## API Coverage

Built against the [Productlane API](https://productlane.mintlify.dev/docs/api). Covers:

- Threads (CRUD + messaging)
- Companies (CRUD + Linear options)
- Contacts (CRUD)
- Issues & Projects (read, portal/roadmap)
- Changelogs (list + create)
- Documentation articles (read)
- Workspace & members (read)

## License

MIT
