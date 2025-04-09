# Salesforce Migrator

A VS Code Extension for migrating records and deploying metadata between Salesforce orgs.

> If you noticed any bugs feel free to create issues.

![Export Records](/images/export-records.gif "Export Records")

## Features

### Salesforce Org Selection

-   **Org Selection:** Provides separate interfaces for selecting source and target Salesforce orgs from already authorized via Salesforce CLI orgs.
-   **Org Categorization:** Organizes available orgs into **DevHub**, **Sandbox**, **Scratch**, and **Other** categories.
-   **Connection Status:** Visual indicators showing connection status (Connected/Disconnected) for each org.

### Metadata Migration

-   **Metadata Type Browser:** Lists all available metadata types from source org with filtering capabilities.
-   **Metadata Component Viewer:** For each type, shows all components available for migration.
-   **Retrieval and Deployment Interface:** Dedicated webview for orchestrating metadata deployment operations.
-   **Deployment Status Tracking:** Shows progress during retrieval and deployment operations with ability to open a Deployment URL in a browser.

### Records Migration

-   **Object Selection:** Browse and select Salesforce objects for data migration.
-   **Field Selection:** Choose which fields to include in DML and Export operations.
-   **Query Builder:** User interface for building SOQL queries.
-   **Progress Tracking:** Real-time progress reporting during operations.
-   **Cancellation Support:** Ability to cancel long-running operations.
-   **Job Status Monitoring:** Polls job status until completion with informative updates.

### UI

-   **Dynamic Theming:** The extension uses VS Code's built-in theme tokens and CSS variables to maintain a consistent native look across all color themes. UI components automatically adapt to your preferred VS Code theme, ensuring proper contrast and seamless integration with the rest of your development environment.

## Demos

More demos abailable [here](https://github.com/akutishevsky/salesforce-migrator/tree/main/images)

## Tips

-   add the `/salesforce-migrator` directory to `.gitignore`.
