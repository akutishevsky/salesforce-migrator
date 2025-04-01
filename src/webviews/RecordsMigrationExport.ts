import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";

export class RecordsMigrationExport {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;
    private _customObject: string;

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
    }

    public async reveal() {
        this._initializePanel();
        this._renderLoader();

        this._panel!.webview.html = this._htmlService.composeHtml({
            body: this._composeWebviewHtml(),
            styles: ["/resources/css/recordsMigration.css"],
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
            <div class="container">
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
                <div>
                    <p>lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                </div>
            </div>
        `;

        return html;
    }

    private _composeDestinationFileSelectionHtml(): string {
        let html = `
            <div>
                <div class="section">
                    <h2>Select a destination file</h2>
                </div>
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
