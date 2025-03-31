import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";
import { OrgService } from "../services/OrgService";
import { MetadataService, MetadataObject } from "../services/MetadataService";

export class MetadataSelectorWebview implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _htmlService!: HtmlService;
    private _webviewView: vscode.WebviewView | undefined;
    private _metadataService: MetadataService;
    private _orgService: OrgService;

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
        this._metadataService = new MetadataService();
        this._orgService = new OrgService(extensionContext);
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): Promise<void> {
        this._webviewView = webviewView;
        this._htmlService = new HtmlService({
            view: webviewView,
            extensionUri: this._extensionContext.extensionUri,
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionContext.extensionUri],
        };

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first."
            );
            return;
        }

        const metadataObjects: MetadataObject[] =
            await this._metadataService.fetchMetadataTypes(sourceOrg);
    }
}
