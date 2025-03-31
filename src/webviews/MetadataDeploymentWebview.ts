import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";

export class MetadataDeploymentWebview {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView
    ) {
        this._extensionContext = extensionContext;
        this._webviewView = webviewView;
        this._htmlService = new HtmlService({
            view: webviewView,
            extensionUri: this._extensionContext.extensionUri,
        });
    }

    public reveal(metadata?: string): void {
        const webviewTitle = `${metadata} Deployment`;

        if (!this._panel) {
            this._panel = vscode.window.createWebviewPanel(
                "salesforce-migrator.metadata-deployment",
                webviewTitle,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [this._extensionContext.extensionUri],
                }
            );

            this._panel.onDidDispose(() => {
                this._panel = undefined;
            });
        }

        this._panel.title = webviewTitle;
        const content = metadata
            ? `Selected metadata: ${metadata}`
            : "Hello, Metadata Deployment!";

        this._panel.webview.html = this._htmlService.composeHtml({
            body: content,
        });

        this._panel.reveal();
    }
}
