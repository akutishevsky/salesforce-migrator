import * as vscode from "vscode";
import { HtmlService, escapeHtml } from "../services/HtmlService";
import { OrgService, SalesforceOrg } from "../services/OrgService";
import { SfBulkApi, BulkQueryJobInfo } from "../api/SfBulkApi";
import { SfRestApi } from "../api/SfRestApi";
import path from "path";

export class RecordsMigrationExport {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;
    private _disposables: vscode.Disposable[] = [];
    private _customObject: string;
    private _orgService: OrgService;
    private _sfBulkApi: SfBulkApi;
    private _sfRestApi: SfRestApi;
    private _fields: any;
    private _fileUri: vscode.Uri | undefined;
    private _sourceOrg: string | undefined;

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView,
        customObject: string,
    ) {
        this._extensionContext = extensionContext;
        this._webviewView = webviewView;
        this._customObject = customObject;

        this._htmlService = new HtmlService({
            view: this._webviewView,
            extensionUri: this._extensionContext.extensionUri,
        });
        this._orgService = new OrgService(this._extensionContext);
        this._sfBulkApi = new SfBulkApi();
        this._sfRestApi = new SfRestApi();
    }

    public async reveal() {
        this._initializePanel();
        this._renderLoader();

        this._sourceOrg = this._orgService.getSourceOrg();
        if (!this._sourceOrg) {
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first.",
            );
            return;
        }

        await this._retrieveFields();
        this._renderWebview();
        this._setupMessageHandlers();
        this._panel!.reveal();
    }

    private _renderWebview(): void {
        this._panel!.webview.html = this._htmlService.composeHtml({
            body: this._composeWebviewHtml(),
            styles: ["/resources/css/recordsMigration.css"],
            scripts: ["/resources/js/recordsMigrationExport.js"],
        });
    }

    private _setupMessageHandlers(): void {
        const messageHandler = this._panel!.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case "getPicklistFieldValues":
                        this._handlePicklistFieldValues(message);
                        break;
                    case "openFileDialog":
                        await this._handleFileDialog(message);
                        break;
                    case "exportRecords":
                        if (
                            typeof message.query !== "string" ||
                            !message.query.trim()
                        ) {
                            return;
                        }
                        if (
                            typeof message.destinationFilePath !== "string" ||
                            !message.destinationFilePath.trim()
                        ) {
                            return;
                        }
                        if (!this._validateQueryObject(message.query)) {
                            vscode.window.showErrorMessage(
                                `Query must select FROM ${this._customObject}. Querying other objects is not allowed.`,
                            );
                            return;
                        }
                        await this._exportRecords(
                            message.query,
                            message.destinationFilePath,
                        );
                        break;
                    default:
                        break;
                }
            },
        );

        // Add to disposables for proper cleanup
        this._disposables.push(messageHandler);
    }

    private _handlePicklistFieldValues(message: any): void {
        if (
            typeof message.fieldApiName !== "string" ||
            !message.fieldApiName.trim()
        ) {
            return;
        }
        const field = this._fields.filter(
            (f: any) => f.name === message.fieldApiName,
        )[0];
        const picklistValues = field.picklistValues;
        this._panel!.webview.postMessage({
            command: "populatePicklistFieldValues",
            value: picklistValues,
        });
    }

    private async _handleFileDialog(message: any): Promise<void> {
        const currentPath = message.currentPath || "";

        this._fileUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(currentPath),
            filters: {
                "CSV files": ["csv"],
                "JSON files": ["json"],
            },
            saveLabel: "Select Destination File",
            title: "Select Destination File",
        });

        if (this._fileUri) {
            this._panel!.webview.postMessage({
                command: "setDestinationFile",
                value: this._fileUri.fsPath,
            });
        }
    }

    private _validateQueryObject(query: string): boolean {
        const match = query.match(/\bFROM\s+(\S+)/i);
        if (!match) {
            return false;
        }
        return match[1].toLowerCase() === this._customObject.toLowerCase();
    }

    private async _exportRecords(
        query: string,
        destinationFilePath: string,
    ): Promise<void> {
        try {
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: "Exporting records...",
                    cancellable: true,
                },
                async (progress, token) => {
                    await this._createFile(destinationFilePath);
                    progress.report({
                        message: `Created the ${destinationFilePath} file.`,
                    });

                    if (!this._sourceOrg) {
                        throw new Error("Source org is not defined");
                    }

                    const orgDetails = await this._orgService.fetchOrgDetails(
                        this._sourceOrg,
                    );
                    await this._createFile(destinationFilePath);
                    progress.report({
                        message: `Retrieved the org details.`,
                    });

                    // First, get the expected record count using direct SOQL
                    let expectedRecordCount: number;
                    try {
                        expectedRecordCount =
                            await this._sfRestApi.queryRecordCount(
                                orgDetails,
                                query,
                            );
                        progress.report({
                            message: `Expected ${expectedRecordCount} records based on direct SOQL query.`,
                        });
                    } catch (error: any) {
                        expectedRecordCount = -1; // Continue without validation
                    }

                    let jobInfo;
                    try {
                        jobInfo = await this._sfBulkApi.createQueryJob(
                            orgDetails,
                            query,
                        );
                        progress.report({
                            message: `Created the job with ID: ${jobInfo.id}`,
                        });
                    } catch (error: any) {
                        vscode.window.showErrorMessage(error.message);
                        this._panel!.webview.postMessage({
                            command: "exportComplete",
                        });
                        return;
                    }

                    try {
                        progress.report({
                            message: `Polling for the results...`,
                        });
                        const csvData =
                            await this._sfBulkApi.pollQueryJobUntilComplete(
                                orgDetails,
                                jobInfo.id,
                                progress,
                                token, // Pass the cancellation token
                            );

                        const fileUri = this._fileUri!;
                        await vscode.workspace.fs.writeFile(
                            fileUri,
                            Buffer.from(csvData),
                        );
                        progress.report({
                            message: `Saved the result to the ${fileUri.fsPath} file.`,
                        });

                        // Validate record count if we have an expected count
                        const lines = csvData
                            .split("\n")
                            .filter((line) => line.trim().length > 0);
                        const actualRecordCount = Math.max(0, lines.length - 1);

                        if (
                            expectedRecordCount >= 0 &&
                            actualRecordCount !== expectedRecordCount
                        ) {
                            const message = `⚠️ Record count mismatch detected!\n\nExpected: ${expectedRecordCount} records\nActual: ${actualRecordCount} records\n\nThis may indicate missing records due to Salesforce Bulk API timing issues. Consider re-running the export or using a smaller date range.`;

                            vscode.window
                                .showWarningMessage(
                                    message,
                                    { modal: true },
                                    "Show File",
                                    "Re-run Export",
                                )
                                .then((selection) => {
                                    if (selection === "Show File") {
                                        vscode.workspace
                                            .openTextDocument(fileUri)
                                            .then((doc) =>
                                                vscode.window.showTextDocument(
                                                    doc,
                                                ),
                                            );
                                    } else if (selection === "Re-run Export") {
                                        // Re-run the export by calling the same method again
                                        this._exportRecords(
                                            query,
                                            fileUri.fsPath,
                                        );
                                    }
                                });
                        } else {
                            const successMessage =
                                expectedRecordCount >= 0
                                    ? `Records exported successfully to ${fileUri.fsPath}\n\nExported ${actualRecordCount} records (matches expected count).`
                                    : `Records exported successfully to ${fileUri.fsPath}\n\nExported ${actualRecordCount} records.`;

                            vscode.window
                                .showInformationMessage(
                                    successMessage,
                                    { modal: false },
                                    "Show File",
                                )
                                .then((selection) => {
                                    if (selection === "Show File") {
                                        vscode.workspace
                                            .openTextDocument(fileUri)
                                            .then((doc) =>
                                                vscode.window.showTextDocument(
                                                    doc,
                                                ),
                                            );
                                    }
                                });
                        }
                    } catch (error: any) {
                        // If operation was cancelled by user, show a different message
                        if (error.message === "Operation cancelled by user") {
                            try {
                                await vscode.workspace.fs.delete(
                                    vscode.Uri.file(destinationFilePath),
                                );
                                vscode.window.showInformationMessage(
                                    `Record export operation cancelled. Deleted the ${destinationFilePath} file.`,
                                );
                            } catch (error: any) {
                                console.error(
                                    `Failed to delete the file: ${error.message}`,
                                );
                            }
                        } else {
                            vscode.window.showErrorMessage(
                                `Failed to retrieve job results: ${error.message}`,
                            );
                        }
                    } finally {
                        this._panel!.webview.postMessage({
                            command: "exportComplete",
                        });
                    }
                },
            );
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to export records: ${error.message}`,
            );
        }
    }

    private async _createFile(destinationFilePath: string): Promise<void> {
        if (!this._fileUri && !destinationFilePath) {
            throw new Error("Please select a destination file.");
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const workspacePath = workspaceFolders[0].uri.fsPath;
            const resolvedPath = path.resolve(destinationFilePath);
            if (
                !resolvedPath.startsWith(workspacePath + path.sep) &&
                resolvedPath !== workspacePath
            ) {
                throw new Error(
                    "Destination file must be within the workspace folder.",
                );
            }
        }

        this._fileUri = vscode.Uri.file(destinationFilePath);

        try {
            await vscode.workspace.fs.writeFile(this._fileUri, Buffer.from(""));
        } catch (error: any) {
            throw new Error(`Failed to create file: ${error.message}`);
        }
    }

    private _initializePanel(): void {
        if (!this._panel) {
            this._panel = vscode.window.createWebviewPanel(
                "salesforce-migrator.records-migration-export",
                `Export ${this._customObject} Records`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [this._extensionContext.extensionUri],
                },
            );

            // Register the panel's dispose event
            const panelDisposeListener = this._panel.onDidDispose(() => {
                this._disposePanel();
            });

            // Add to disposables
            this._disposables.push(panelDisposeListener);
        }
    }

    private _renderLoader(): void {
        this._panel!.webview.html = this._htmlService.getLoaderHtml();
    }

    private async _retrieveFields(): Promise<void> {
        if (!this._sourceOrg) {
            throw new Error("Source org is not defined");
        }

        try {
            const orgDetails = await this._orgService.fetchOrgDetails(
                this._sourceOrg,
            );
            const objectDescription = await this._sfRestApi.describeObject(
                orgDetails,
                this._customObject,
            );

            this._fields = objectDescription.fields;

            // Sort fields by label for better UX
            this._fields.sort((a: any, b: any) => {
                return a.label.localeCompare(b.label);
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to retrieve object fields: ${error.message}`,
            );
            throw error;
        }
    }

    private _composeWebviewHtml(): string {
        let html = "";

        const safeObject = escapeHtml(this._customObject);
        const safeOrg = escapeHtml(this._sourceOrg || "");
        html += `
            <div data-object-name="${safeObject}" class="sfm-container">
                <div class="sfm-header">
                    <h1>Export ${safeObject} records from <span class="org-name">${safeOrg}</span> org</h1>
                </div>
                <div class="sfm-content">
                    ${this._composeFieldsToQueryHtml()}
                    ${this._composeDestinationFileSelectionHtml()}
                    ${this._composeExportButtonHtml()}
                </div>
            </div>
        `;

        return html;
    }

    private _composeFieldsToQueryHtml(): string {
        let html = `
            <div class="sfm-panel">
                <div class="sfm-panel-header">
                     <h2>Select fields to query</h2>
                </div>
                <div class="sfm-fields-container">
                    <div class="sfm-fields-selector">
                        <div class="sfm-fields-selector-header">
                            <h3>Select fields</h3>
                            <div class="sfm-fields-actions">
                                <button id="add-all-fields" class="sfm-button sfm-button-small">
                                    Add All
                                </button>
                                <button id="clear-all-fields" class="sfm-button sfm-button-small">
                                    Clear All
                                </button>
                            </div>
                        </div>
                        <div class="sfm-filter">
                            <input type="text" placeholder="Filter fields (by Label, API Name, or Type)" />
                        </div>
                        <div class="sfm-fields-list">
                            ${this._composeFieldsToQueryFieldsListHtml()}
                        </div>
                    </div>
                    <div class="sfm-where-clause">
                        ${this._composeWhereClauseComposerHtml()}
                    </div>
                </div>
                <div class="sfm-query-editor">
                    <div class="sfm-query-editor-header">
                        <h3>Result query (editable)</h3>
                        <button id="copy-query-button" class="sfm-button sfm-button-small">Copy Query</button>
                    </div>
                    <textarea id="query" class="sfm-query-textarea"></textarea>
                </div>
            </div>
        `;

        return html;
    }

    private _composeFieldsToQueryFieldsListHtml(): string {
        let html = "";

        this._fields.forEach((field: any) => {
            const safeName = escapeHtml(field.name);
            const safeLabel = escapeHtml(field.label);
            const safeType = escapeHtml(field.type);
            html += `
                <div class="sfm-field-item">
                    <input type="checkbox" data-field-name="${safeName}" />
                    <label class="sfm-field-label">
                        <span class="sfm-field-label-name">${safeLabel}</span>
                        <span class="sfm-field-api-name"> • ${safeName}</span>
                        <span class="sfm-field-type"> • ${safeType}</span>
                    </label>
                </div>
            `;
        });

        return html;
    }

    private _composeWhereClauseComposerHtml(): string {
        let html = `
            <h3>Compose WHERE clause</h3>
            <div class="sfm-where-field-selector">
                <label for="where-field-selector" class="sfm-label">Field:</label>
                ${this._composeWhereClauseComposerFieldsHtml()}
            </div>
            <div class="sfm-where-operation">
                ${this._composeWhereClauseOperationSelectorHtml()}
            </div>
            <div class="sfm-where-value">
                <label for="where-value" class="sfm-label">Value:</label>
                <input id="where-value" type="text" placeholder="Enter condition value" />
                <select id="where-value-select" style="display:none;"></select>
            </div>
            <div class="sfm-button-group">
                <button id="add-where-clause" class="sfm-button">Add Condition</button>
                <button id="clear-where-clause" class="sfm-button">Clear Condition</button>
                <button id="clear-all-where-clauses" class="sfm-button">Clear All Conditions</button>
            </div>
        `;

        return html;
    }

    private _composeWhereClauseComposerFieldsHtml(): string {
        let html = '<select id="where-field-selector" class="sfm-select">';

        this._fields.forEach((field: any) => {
            const safeName = escapeHtml(field.name);
            const safeLabel = escapeHtml(field.label);
            const safeType = escapeHtml(field.type);
            html += `
                <option value="${safeName}" data-field-type="${safeType}">
                    ${safeLabel} • ${safeName} • ${safeType}
                </option>
            `;
        });

        html += "</select>";

        return html;
    }

    private _composeWhereClauseOperationSelectorHtml(): string {
        return `
            <label for="where-operation" class="sfm-label">Operation:</label>
            <select id="where-operation" class="sfm-select">
                <option value="=">Equals</option>
                <option value="!=">Not Equals</option>
                <option value="LIKE">Like</option>
                <option value="<">Less than</option>
                <option value=">">Greater than</option>
                <option value="<=">Less than or equal</option>
                <option value=">=">Greater than or equal</option>
            </select>
        `;
    }

    private _composeDestinationFileSelectionHtml(): string {
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath =
            workspaceFolders && workspaceFolders.length > 0
                ? workspaceFolders[0].uri.fsPath
                : "";

        const defaultPath = path.join(
            workspacePath,
            `salesforce-migrator/${this._customObject}/Export/${this._customObject}_${dateStr}_${timeStr}.csv`,
        );

        let html = `
            <div class="sfm-panel">
                <h2>Select a destination file</h2>
                <div class="sfm-panel-content">
                    <div class="sfm-file-selector">
                        <label for="destination-file" class="sfm-label">Destination file:</label>
                        <div class="sfm-file-input-container">
                            <input 
                                type="text" 
                                id="destination-file" 
                                class="sfm-file-input" 
                                value="${path.normalize(defaultPath)}" 
                                placeholder="Enter file path or click Browse" 
                            />
                            <button id="browse-file-button" class="sfm-button">Browse</button>
                        </div>
                        <p class="sfm-file-hint">Select an existing file or create a new one. Records will be exported as CSV.</p>
                    </div>
                </div>
            </div>
        `;

        return html;
    }

    private _composeExportButtonHtml(): string {
        let html = `
            <div class="sfm-panel sfm-panel-actions">
                <div class="sfm-action-container">
                    <div id="error-message" class="sfm-error-message"></div>
                    <button id="action-button" class="sfm-button sfm-button-primary">Export</button>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Dispose all panel resources
     */
    private _disposePanel(): void {
        // Dispose all disposables
        this._disposables.forEach((d) => d.dispose());
        this._disposables = [];

        // Clear panel reference
        this._panel = undefined;
    }
}
