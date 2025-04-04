import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";
import { SfCommandService } from "../services/SfCommandService";
import { OrgService, SalesforceOrg } from "../services/OrgService";
import path from "path";

export class RecordsMigrationExport {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;
    private _customObject: string;
    private _sfCommandService: SfCommandService;
    private _orgService: OrgService;
    private _fields: any;

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView,
        customObject: string
    ) {
        this._extensionContext = extensionContext;
        this._webviewView = webviewView;
        this._customObject = customObject;

        this._htmlService = new HtmlService({
            view: this._webviewView,
            extensionUri: this._extensionContext.extensionUri,
        });
        this._sfCommandService = new SfCommandService();
        this._orgService = new OrgService(this._extensionContext);
    }

    public async reveal() {
        this._initializePanel();
        this._renderLoader();

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first."
            );
            return;
        }

        await this._retrieveFields(sourceOrg);
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
        this._panel!.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case "getPicklistFieldValues":
                        this._handlePicklistFieldValues(message);
                        break;
                    case "openFileDialog":
                        await this._handleFileDialog(message);
                        break;
                    default:
                        break;
                }
            },
            undefined,
            this._extensionContext.subscriptions
        );
    }

    private _handlePicklistFieldValues(message: any): void {
        const field = this._fields.filter(
            (f: any) => f.name === message.fieldApiName
        )[0];
        const picklistValues = field.picklistValues;
        this._panel!.webview.postMessage({
            command: "populatePicklistFieldValues",
            value: picklistValues,
        });
    }

    private async _handleFileDialog(message: any): Promise<void> {
        const currentPath = message.currentPath || "";

        const fileUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(currentPath),
            filters: {
                "CSV files": ["csv"],
                "JSON files": ["json"],
            },
            saveLabel: "Select Destination File",
            title: "Select Destination File",
        });

        if (fileUri) {
            this._panel!.webview.postMessage({
                command: "setDestinationFile",
                value: fileUri.fsPath,
            });
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
                }
            );
        }
    }

    private _renderLoader(): void {
        this._panel!.webview.html = this._htmlService.getLoaderHtml();
    }

    private async _retrieveFields(sourceOrg: string): Promise<any> {
        const orgDisplay = await this._orgService.fetchOrgDetails(sourceOrg);

        const url = `${orgDisplay.instanceUrl}/services/data/v63.0/sobjects/${this._customObject}/describe/`;
        const result = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${orgDisplay.accessToken}`,
                "Content-Type": "application/json",
            },
        });
        const describe: any = await result.json();
        this._fields = describe.fields;

        this._fields.sort((a: any, b: any) => {
            return a.label.localeCompare(b.label);
        });
    }

    private _composeWebviewHtml(): string {
        let html = "";

        html += `
            <div data-object-name="${this._customObject}" class="sfm-container">
                <div class="sfm-header">
                    <h1>Export ${this._customObject} Records</h1>
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
                    <h3>Result query (editable)</h3>
                    <textarea id="query" class="sfm-query-textarea"></textarea>
                </div>
            </div>
        `;

        return html;
    }

    private _composeFieldsToQueryFieldsListHtml(): string {
        let html = "";

        this._fields.forEach((field: any) => {
            html += `
                <div class="sfm-field-item">
                    <input type="checkbox" data-field-name="${field.name}" />
                    <label class="sfm-field-label">
                        <span class="sfm-field-label-name">${field.label}</span>
                        <span class="sfm-field-api-name"> • ${field.name}</span>
                        <span class="sfm-field-type"> • ${field.type}</span>
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
            html += `
                <option value="${field.name}" data-field-type="${field.type}">
                    ${field.label} • ${field.name} • ${field.type}
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
        // Format the current date and time for the filename
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS

        // Create the default path following the requested structure
        // "salesforce-migrator/{objectName}/Export/{objectName}_{date_time}.csv"
        const defaultPath = `salesforce-migrator/${this._customObject}/Export/${this._customObject}_${dateStr}_${timeStr}.csv`;

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
                <button id="export-button" class="sfm-button sfm-button-primary">Export</button>
            </div>
        `;

        return html;
    }
}
