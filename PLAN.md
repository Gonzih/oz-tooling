# PLAN: OZ Tooling Monorepo

## Task Summary
Build a monorepo of 4 Opportunity Zone MCP (Model Context Protocol) packages, publish to npm under @gonzih/oz-*, and write a recommendations README.

## Approach

**Chosen: Monorepo with independent packages**
- Each package is self-contained with its own package.json, tsconfig.json, and src/index.ts
- Shared root for README only (no shared code to avoid coupling)
- Each package embeds its own domain logic inline
- No workspace-level build tooling needed (just per-package npm scripts)

Trade-offs vs alternatives:
- Workspace-level tsc/shared types: more complex setup, not needed here
- Single bundled package: harder for users to pick only what they need

## Files to Touch

```
oz-tooling/
├── README.md
├── PLAN.md
├── TODO.md
├── packages/
│   ├── oz-calc/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   ├── oz-zones/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   ├── oz-compliance/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   └── oz-timeline/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts
```

## Risks & Unknowns
- npm publish requires @gonzih org access — will attempt publish, failure is non-blocking for code quality
- @modelcontextprotocol/sdk API surface: must use correct tool registration pattern
- OZ data: will embed representative dataset for oz-zones (not exhaustive IRS list)

## MCP SDK Pattern
Each package uses `McpServer` with `server.tool()` registrations, connected via `StdioServerTransport`.
