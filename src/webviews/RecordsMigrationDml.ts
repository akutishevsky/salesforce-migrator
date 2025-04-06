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
}
