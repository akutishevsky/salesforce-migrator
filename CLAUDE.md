# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Salesforce Migrator is a VS Code extension for migrating Salesforce records and metadata between orgs using Bulk API 2.0. The extension only activates in SFDX projects (requires `sfdx-project.json`).

## Build and Development Commands

```bash
npm run watch     # Start TypeScript watcher during development
npm run compile   # Build for production
npm run lint      # Check code quality with ESLint
npm run pretest   # Compile, lint, and prepare tests
npm run test      # Run tests with vscode-test
```

## Architecture

```
Extension Entry Point (src/extension.ts)
    │
    ├── Views Layer (src/views/)
    │   ├── OrgSelectorView.ts      # Source/Target org selection webviews
    │   ├── MetadataSelectorView.ts # Metadata type browsing
    │   └── RecordsSelectorView.ts  # Custom object browsing
    │
    ├── Webviews Layer (src/webviews/)
    │   ├── MetadataDeploymentWebview.ts # Metadata retrieval/deployment via CLI
    │   ├── RecordsMigrationExport.ts    # Export records via Bulk API query jobs
    │   └── RecordsMigrationDml.ts       # DML operations (insert/update/delete/upsert)
    │
    ├── Services Layer (src/services/)
    │   ├── OrgService.ts        # Org state and selection (stored in workspace state)
    │   ├── SfCommandService.ts  # Salesforce CLI command execution (100MB buffer)
    │   ├── MetadataService.ts   # Metadata listing and fetching
    │   ├── ObjectService.ts     # Custom object listing
    │   └── HtmlService.ts       # Webview HTML composition
    │
    └── API Layer (src/api/)
        ├── SfBulkApi.ts  # Bulk API 2.0 (query jobs, DML jobs, pagination)
        └── SfRestApi.ts  # REST API (describe, query count)
```

## Key Data Flows

**Records Export**: User selects object → builds SOQL → validates count via REST API → creates Bulk API query job → polls until complete → retrieves paginated results → exports CSV

**Records DML**: User uploads CSV → selects operation → normalizes line endings (Windows fix) → creates Bulk API DML job → uploads data → polls until complete → shows results

**Metadata Migration**: Uses Salesforce CLI commands (`sf org retrieve` / `sf org deploy`)

## Critical Implementation Details

- **Windows line-ending normalization**: `SfBulkApi.ts:uploadJobData()` converts CRLF→LF and removes BOM (fixes issue #6)
- **Pagination with query locators**: Query results may span multiple API calls; `Sfdx-Locator` header indicates more data
- **Record count validation**: Pre/post-operation count verification in export operations
- **Cancellation support**: Long-running operations support VS Code cancellation tokens with process group cleanup

## Code Style

- TypeScript strict mode with 4-space indentation
- Semicolons required, strict equality (`===`), curly braces required
- camelCase for variables/functions, PascalCase for classes and type imports
