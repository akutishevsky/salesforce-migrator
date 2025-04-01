import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";
import { SfCommandService } from "../services/SfCommandService";
import { OrgService } from "../services/OrgService";

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

        this._panel!.webview.html = this._htmlService.composeHtml({
            body: this._composeWebviewHtml(),
            styles: ["/resources/css/recordsMigration.css"],
            scripts: ["/resources/js/recordsMigrationExport.js"],
        });

        this._panel!.reveal();
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
                        <h3>Select fields</h3>
                        <div class="sfm-filter">
                            <input type="text" placeholder="Filter fields" />
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
                ${this._composeWhereClauseComposerFieldsHtml()}
            </div>
            <div class="sfm-where-operation">Operation: EQUALS</div>
            <div class="sfm-where-value">
                <input type="text" placeholder="Value" />
            </div>
            <div class="sfm-button-group">
                <button id="add-where-clause" class="sfm-button">Add Condition</button>
                <button id="clear-where-clause" class="sfm-button">Clear Condition</button>
                <button id="clear-all-where-clause" class="sfm-button">Clear All Conditions</button>
            </div>
        `;

        return html;
    }

    private _composeWhereClauseComposerFieldsHtml(): string {
        let html = "<select class=\"sfm-select\">";

        this._fields.forEach((field: any) => {
            html += `
                <option value="${field.name}">
                    ${field.label} • ${field.name} • ${field.type}
                </option>
            `;
        });

        html += "</select>";

        return html;
    }

    private _composeDestinationFileSelectionHtml(): string {
        let html = `
            <div class="sfm-panel">
                <h2>Select a destination file</h2>
                <div class="sfm-panel-content">
                    <p>lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
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
