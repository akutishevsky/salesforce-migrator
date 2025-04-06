import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";

export class RecordsMigrationDml {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _customObject: string;
    private _operation: string;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView,
        customObject: string,
        operation: string
    ) {
        this._extensionContext = extensionContext;
        this._webviewView = webviewView;
        this._customObject = customObject;
        this._operation = operation;
        this._htmlService = new HtmlService({
            view: webviewView,
            extensionUri: extensionContext.extensionUri,
        });
    }

    public async reveal(): Promise<void> {
        this._initializePanel();
        this._renderLoader();

        this._renderWebview();

        this._panel!.reveal();
    }

    private _initializePanel(): void {
        if (!this._panel) {
            this._panel = vscode.window.createWebviewPanel(
                "salesforce-migrator.records-migration-dml",
                `${this._operation} ${this._customObject} Records`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [this._extensionContext.extensionUri],
                }
            );
        }
    }

    private _renderLoader(): void {
        if (!this._panel) {
            vscode.window.showErrorMessage(
                "Webview panel is not initialized. Please try again."
            );
            return;
        }
        this._panel!.webview.html = this._htmlService.getLoaderHtml();
    }

    private _renderWebview(): void {
        this._panel!.webview.html = this._htmlService.composeHtml({
            body: this._composeWebviewHtml(),
            title: `${this._operation} ${this._customObject} Records`,
            styles: ["/resources/css/recordsMigration.css"],
            scripts: ["/resources/js/recordsMigrationDml.js"],
        });
    }

    private _composeWebviewHtml(): string {
        let html = "";

        html += `
            <div data-object-name="${this._customObject}" class="sfm-container">
                <div class="sfm-header">
                    <h1>${this._operation} ${this._customObject} Records</h1>
                </div>
                <div class="sfm-content">
                        // select a file |  results file
                        ${this._composeFileSelectorsHtml()}
                        // (for uspert) select a matching field
                        // mapping file
                </div>
            </div>
        `;

        return html;
    }

    private _composeFileSelectorsHtml(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath =
            workspaceFolders && workspaceFolders.length > 0
                ? workspaceFolders[0].uri.fsPath
                : "";

        return `
            <div class="sfm-panel">
                <div class="sfm-panel-header">
                     <h2>Select file to import from</h2>
                </div>
                <div class="sfm-panel-content">
                    <div class="sfm-file-selector">
                        <label for="source-file" class="sfm-label">Source file:</label>
                        <div class="sfm-file-input-container">
                            <input 
                                type="text" 
                                id="source-file" 
                                class="sfm-file-input" 
                                placeholder="Enter CSV file path or click Browse" 
                            />
                            <button id="browse-file-button" class="sfm-button">Browse</button>
                        </div>
                        <p class="sfm-file-hint">
                            Select a CSV file containing the records to ${this._operation.toLowerCase()}.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
}
