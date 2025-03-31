import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";

export class MetadataDeploymentWebview {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _htmlService: HtmlService;

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

    public reveal(): void {
        const webviewPanel = vscode.window.createWebviewPanel(
            "metadataDeployment",
            "Metadata Deployment",
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [this._extensionContext.extensionUri],
            }
        );

        webviewPanel.onDidDispose(() => {
            webviewPanel.dispose();
        });

        webviewPanel.webview.html = this._htmlService.composeHtml({
            body: "Hello, Metadata Deployment!",
        });
    }
}
