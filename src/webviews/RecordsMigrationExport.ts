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
            <div data-object-name="${this._customObject}" class="container">
                <div class="header">
                    <h1>Export ${this._customObject} Records</h1>
                </div>
                <div class="content">
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
            <div class="section">
                <div>
                     <h2>Select fields to query</h2>
                </div>
                <div class="fields-to-query-container">
                    <div class="fields-to-query_fields-container">
                        <h3>Select fields</h3>
                        <div class="fields-to-query_fields-filter">
                            <input type="text" placeholder="Filter fields" />
                        </div>
                        <div class="fields-to-query_fields-list">
                            ${this._composeFieldsToQueryFieldsListHtml()}
                        </div>
                    </div>
                    <div class="fields-to-query_fields-compose-where-clause">
                        <h3>Compose WHERE clause</h3>
                        <textarea placeholder="WHERE Id = '001...'"></textarea>
                    </div>
                </div>
                <div>
                    <h3>Result query (editable)</h3>
                    <textarea id="query"></textarea>
                </div>
            </div>
        `;

        return html;
    }

    private _composeFieldsToQueryFieldsListHtml(): string {
        let html = "";

        this._fields.forEach((field: any) => {
            html += `
                <div class="fields-to-query_fields-list-item">
                    <input type="checkbox" data-field-name="${field.name}" />
                    <label>
                        <span class="field-label">${field.label}</span>
                        <span class="field-name"> • ${field.name}</span>
                        <span class="field-type"> • ${field.type}</span>
                    </label>
                </div>
            `;
        });

        return html;
    }

    private _composeDestinationFileSelectionHtml(): string {
        let html = `
            <div class="section">
                <h2>Select a destination file</h2>
                <div>
                    <p>lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                </div>
            </div>
        `;

        return html;
    }

    private _composeExportButtonHtml(): string {
        let html = `
            <div class="section">
                <button id="export-button">Export</button>
            </div>
        `;

        return html;
    }
}
