# Salesforce Migrator

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=akutishevsky_salesforce-migrator&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=akutishevsky_salesforce-migrator)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=akutishevsky_salesforce-migrator&metric=bugs)](https://sonarcloud.io/summary/new_code?id=akutishevsky_salesforce-migrator)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=akutishevsky_salesforce-migrator&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=akutishevsky_salesforce-migrator)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=akutishevsky_salesforce-migrator&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=akutishevsky_salesforce-migrator)

A VS Code Extension for migrating Salesforce records and metadata between orgs. It uses the Salesforce Bulk API 2.0 under the hood.

> If you noticed any bugs feel free to create issues.

![Export Records](/images/demos/export-records.gif "Export Records")

## Features

### Salesforce Org Selection

- **Org Selection:** Provides separate interfaces for selecting source and target Salesforce orgs from already authorized via Salesforce CLI orgs.
- **Org Categorization:** Organizes available orgs into **DevHub**, **Sandbox**, **Scratch**, and **Other** categories.
- **Connection Status:** Visual indicators showing connection status (Connected/Disconnected) for each org.

### Metadata Migration

- **Metadata Type Browser:** Lists all available metadata types from source org with filtering capabilities.
- **Folder-based Metadata:** Supports folder-based metadata types (EmailTemplate, Report, Dashboard, Document) with an inline expandable tree for browsing folders and their items.
- **Metadata Component Viewer:** For each type, shows all components available for migration.
- **Multi-select Metadata:** Select multiple metadata items across different types using checkboxes. Accumulated selections are shown in a dedicated "Selected Metadata" sidebar view for batch retrieval or deployment.
- **Retrieval and Deployment Interface:** Dedicated webview for orchestrating metadata deployment operations.
- **Deployment Status Tracking:** Shows progress during retrieval and deployment operations with ability to open a Deployment URL in a browser.

### Records Migration

- **Object Selection:** Browse and select Salesforce objects for data migration.
- **Field Selection:** Choose which fields to include in DML and Export operations.
- **Query Builder:** User interface for building SOQL queries.
- **Progress Tracking:** Real-time progress reporting during operations.
- **Cancellation Support:** Ability to cancel long-running operations.
- **Job Status Monitoring:** Polls job status until completion with informative updates.

### UI

- **Dynamic Theming:** The extension uses VS Code's built-in theme tokens and CSS variables to maintain a consistent native look across all color themes. UI components automatically adapt to your preferred VS Code theme, ensuring proper contrast and seamless integration with the rest of your development environment.

## Demos

More demos abailable [here](https://github.com/akutishevsky/salesforce-migrator/tree/main/images/demos)

## Installation

- Open Visual Studio Code.
- Go to the Extensions view (Ctrl+Shift+X or Cmd+Shift+X).
- Search for "Salesforce Migrator".
- Click "Install".

Alternatively, you can install it from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AntonKutishevsky.salesforce-migrator).

## Tips

- add the `/salesforce-migrator` directory to `.gitignore`.
