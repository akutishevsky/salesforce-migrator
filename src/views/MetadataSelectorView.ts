import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";
import { OrgService } from "../services/OrgService";
import { MetadataService, MetadataObject } from "../services/MetadataService";
import { MetadataDeploymentWebview } from "../webviews/MetadataDeploymentWebview";

export class MetadataSelectorView implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _htmlService!: HtmlService;
    private _webviewView: vscode.WebviewView | undefined;
    private _metadataService: MetadataService;
    private _orgService: OrgService;
    private _deploymentWebview: MetadataDeploymentWebview | undefined;

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

        this._deploymentWebview = new MetadataDeploymentWebview(
            this._extensionContext,
            this._webviewView
        );

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first."
            );
            return;
        }

        const metadataObjects: MetadataObject[] =
            await this._metadataService.fetchMetadataTypes(sourceOrg);

        this._composeWebviewHtml(metadataObjects);
        this._setupMessageListener(webviewView);
    }

    private _composeWebviewHtml(metadataObjects: MetadataObject[]): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.composeHtml({
            body: this._composeMetadataHtml(metadataObjects),
            styles: ["/resources/css/metadataSelectorView.css"],
            scripts: ["/resources/js/metadataSelectorView.js"],
        });
    }

    private _composeMetadataHtml(metadataObjects: MetadataObject[]): string {
        metadataObjects.sort((a, b) => {
            return a.xmlName.localeCompare(b.xmlName);
        });

        let html = `
            <div>
                ${this._composeMetadataFilterHtml()}
                ${this._composeMetadataListHtml(metadataObjects)}
            </div>
        `;

        return html;
    }

    private _composeMetadataFilterHtml(): string {
        return `
            <div class="metadata-filter-container">
                <input type="text" id="metadata-filter" placeholder="Filter Metadata" />
            </div>
        `;
    }

    private _composeMetadataListHtml(
        metadataObjects: MetadataObject[]
    ): string {
        let html = `<div class="metadata-list">`;
        for (const metadataObject of metadataObjects) {
            html += `<div class="metadata-list-item">${metadataObject.xmlName}</div>`;
        }
        html += `</div>`;

        return html;
    }

    private _setupMessageListener(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(
            this._processWebviewMessage.bind(this),
            undefined,
            this._extensionContext.subscriptions
        );
    }

    private _processWebviewMessage(message: any): void {
        switch (message.command) {
            case "metadataSelected":
                if (!this._deploymentWebview) {
                    vscode.window.showErrorMessage(
                        "Deployment webview is not initialized."
                    );
                    return;
                }

                this._deploymentWebview.reveal(message.metadata);
                break;
        }
    }
}
