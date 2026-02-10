import * as vscode from "vscode";
import { HtmlService, escapeHtml } from "../services/HtmlService";
import { ObjectService, CustomObject } from "../services/ObjectService";
import { OrgService } from "../services/OrgService";
import { RecordsMigrationExport } from "../webviews/RecordsMigrationExport";
import { RecordsMigrationDml } from "../webviews/RecordsMigrationDml";

export class RecordsSelectorView implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView | undefined;
    private _htmlService!: HtmlService;
    private _orgService: OrgService;
    private _objectService: ObjectService;

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
        this._orgService = new OrgService(extensionContext);
        this._objectService = new ObjectService();
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
    ): Promise<void> {
        this._webviewView = webviewView;
        this._htmlService = new HtmlService({
            view: this._webviewView,
            extensionUri: this._extensionContext.extensionUri,
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionContext.extensionUri],
        };

        this._renderLoader();

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            this._renderNoSourceOrg();
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first.",
            );
            return;
        }

        const customObjects: CustomObject[] =
            await this._objectService.getCustomObjects(sourceOrg);

        this._composeWebviewHtml(customObjects);
        this._setupMessageListener(webviewView);
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

    private _composeWebviewHtml(customObjects: CustomObject[]): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.composeHtml({
            body: this._composeObjectsHtml(customObjects),
            styles: ["/resources/css/list.css"],
            scripts: [
                "/resources/js/list.js",
                "/resources/js/recordsSelectorView.js",
            ],
        });

        // Ensure message listener is setup after HTML is updated
        this._setupMessageListener(this._webviewView);
    }

    private _composeObjectsHtml(customObjects: CustomObject[]): string {
        customObjects.sort((a, b) => {
            return a.fullName.localeCompare(b.fullName);
        });

        let html = `
            <div>
                ${this._composeObjectFilterHtml()}
                ${this._composeObjectListHtml(customObjects)}
            </div>
        `;

        return html;
    }

    private _composeObjectFilterHtml(): string {
        return `
            <div class="filter-container">
                <input type="text" id="filter" placeholder="Filter Objects" />
            </div>
        `;
    }

    private _composeObjectListHtml(customObjects: CustomObject[]): string {
        let html = `<div class="list">`;
        for (const customObject of customObjects) {
            html += `<div class="list-item">${escapeHtml(customObject.fullName)}</div>`;
        }
        html += `</div>`;

        return html;
    }

    private _setupMessageListener(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(
            this._processWebviewMessage.bind(this),
            undefined,
            this._extensionContext.subscriptions,
        );
    }

    private async _processWebviewMessage(message: any): Promise<void> {
        switch (message.command) {
            case "customObjectSelected":
                if (
                    typeof message.customObject !== "string" ||
                    !message.customObject.trim()
                ) {
                    return;
                }
                const customObject = message.customObject;
                const operations = [
                    "Export",
                    "Insert",
                    "Update",
                    "Upsert",
                    "Delete",
                ];

                const selectedOperation = await vscode.window.showQuickPick(
                    operations,
                    {
                        placeHolder: `Select migration operation for ${customObject}`,
                        canPickMany: false,
                    },
                );

                if (selectedOperation) {
                    this._openMigrationWebview(customObject, selectedOperation);
                }
                break;
        }
    }

    private _openMigrationWebview(
        customObject: string,
        operation: string,
    ): void {
        if (operation === "Export") {
            this._openExportWebview(customObject);
        } else if (
            operation === "Insert" ||
            operation === "Update" ||
            operation === "Upsert" ||
            operation === "Delete"
        ) {
            this._openDmlWebview(customObject, operation);
        }
    }

    private _exportWebview: RecordsMigrationExport | undefined;
    private _dmlWebview: RecordsMigrationDml | undefined;

    private _openExportWebview(customObject: string): void {
        // Dispose any existing export webview
        this._exportWebview = undefined;

        // Create new export webview
        this._exportWebview = new RecordsMigrationExport(
            this._extensionContext,
            this._webviewView!,
            customObject,
        );
        this._exportWebview.reveal();
    }

    private _openDmlWebview(customObject: string, operation: string): void {
        // Dispose any existing DML webview
        this._dmlWebview = undefined;

        // Create new DML webview
        this._dmlWebview = new RecordsMigrationDml(
            this._extensionContext,
            this._webviewView!,
            customObject,
            operation,
        );
        this._dmlWebview.reveal();
    }

    /**
     * Refresh the custom objects list from the source org
     */
    /**
     * Dispose resources
     */
    public dispose(): void {
        // Clear references to release resources
        this._exportWebview = undefined;
        this._dmlWebview = undefined;
    }

    public async refreshRecords(): Promise<void> {
        if (!this._webviewView) {
            return;
        }

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            this._renderNoSourceOrg();
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first.",
            );
            return;
        }

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "Refreshing custom objects...",
                cancellable: false,
            },
            async () => {
                try {
                    this._renderLoader();
                    const customObjects: CustomObject[] =
                        await this._objectService.getCustomObjects(sourceOrg);
                    this._composeWebviewHtml(customObjects);
                    vscode.window.showInformationMessage(
                        "Custom objects refreshed successfully.",
                    );
                } catch (error: any) {
                    vscode.window.showErrorMessage(
                        `Failed to refresh custom objects: ${
                            error.message || error
                        }`,
                    );
                }
            },
        );
    }
}
