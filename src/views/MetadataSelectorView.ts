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

    /**
     * Refresh the metadata list from the source org
     */
    public async refreshMetadata(): Promise<void> {
        if (!this._webviewView) {
            return;
        }

        this._renderLoader();

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            this._renderNoSourceOrg();
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first."
            );
            return;
        }

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Refreshing metadata...",
                cancellable: false,
            },
            async () => {
                try {
                    const metadataObjects: MetadataObject[] =
                        await this._metadataService.fetchMetadataObjects(
                            sourceOrg
                        );
                    this._composeWebviewHtml(metadataObjects);
                    vscode.window.showInformationMessage(
                        "Metadata refreshed successfully."
                    );
                } catch (error: any) {
                    vscode.window.showErrorMessage(
                        `Failed to refresh metadata: ${error.message || error}`
                    );
                }
            }
        );
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

        this._renderLoader();

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
            this._renderNoSourceOrg();
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first."
            );
            return;
        }

        try {
            const metadataObjects: MetadataObject[] =
                await this._metadataService.fetchMetadataObjects(sourceOrg);

            this._composeWebviewHtml(metadataObjects);
            this._setupMessageListener(webviewView);
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to load metadata: ${error.message || error}`
            );
            // Show empty state or error state
            this._showErrorState();
        }
    }

    private _renderLoader(): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.getLoaderHtml();
    }

    private _renderNoSourceOrg(): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.getNoSourceOrgHtml();
    }

    private _composeWebviewHtml(metadataObjects: MetadataObject[]): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.composeHtml({
            body: this._composeMetadataHtml(metadataObjects),
            styles: ["/resources/css/list.css"],
            scripts: [
                "/resources/js/list.js",
                "/resources/js/metadataSelectorView.js",
            ],
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
            <div class="filter-container">
                <input type="text" id="filter" placeholder="Filter Metadata" />
            </div>
        `;
    }

    private _composeMetadataListHtml(
        metadataObjects: MetadataObject[]
    ): string {
        let html = `<div class="list">`;
        for (const metadataObject of metadataObjects) {
            html += `<div class="list-item">${metadataObject.xmlName}</div>`;
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

    /**
     * Display an error state in the webview
     */
    private _showErrorState(): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.composeHtml({
            body: `
                <div class="error-container">
                    <p class="error-message">
                        Failed to load metadata. Please try clicking the refresh button in the view header
                        or check your connection to the source org.
                    </p>
                </div>
            `,
        });
    }
}
