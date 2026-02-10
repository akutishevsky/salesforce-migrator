import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";

export type BatchActionCallback = (
    action: "batchRetrieve" | "batchDeploy" | "clearSelections" | "removeItem",
    data?: { key: string; item: string },
) => void;

export class MetadataSelectionView implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _htmlService!: HtmlService;
    private _webviewView: vscode.WebviewView | undefined;
    private _selectedItems: Map<string, string[]> = new Map();
    private _onBatchAction: BatchActionCallback | undefined;

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
    }

    public setOnBatchAction(callback: BatchActionCallback): void {
        this._onBatchAction = callback;
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken,
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

        this._render();
        this._setupMessageListener(webviewView);
    }

    public updateSelections(selectedItems: Map<string, string[]>): void {
        this._selectedItems = new Map(selectedItems);
        this._render();
    }

    private _render(): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.composeHtml({
            body: this._composeBodyHtml(),
            styles: ["/resources/css/metadataSelectionView.css"],
            scripts: ["/resources/js/metadataSelectionView.js"],
        });
    }

    private _composeBodyHtml(): string {
        const totalCount = this._getTotalCount();

        if (totalCount === 0) {
            return `
                <div class="empty-state">
                    <p>No items selected.</p>
                    <p class="empty-hint">Select items using checkboxes in the metadata deployment panel.</p>
                </div>
            `;
        }

        let groupsHtml = "";
        const sortedKeys = Array.from(this._selectedItems.keys()).sort();

        for (const key of sortedKeys) {
            const items = this._selectedItems.get(key)!;
            if (items.length === 0) {
                continue;
            }

            const sortedItems = [...items].sort();

            let itemsHtml = "";
            for (const item of sortedItems) {
                itemsHtml += `
                    <div class="selection-item">
                        <span class="selection-item-name" title="${item}">${item}</span>
                        <button class="remove-item" data-key="${key}" data-item="${item}" title="Remove">&#10005;</button>
                    </div>
                `;
            }

            groupsHtml += `
                <div class="selection-group">
                    <div class="selection-group-header">${key}</div>
                    ${itemsHtml}
                </div>
            `;
        }

        return `
            <div class="selection-container">
                ${groupsHtml}
            </div>
            <div class="selection-actions">
                <button id="batch-retrieve" class="action-btn">Retrieve All (${totalCount})</button>
                <button id="batch-deploy" class="action-btn">Deploy All (${totalCount})</button>
                <button id="clear-selections" class="action-btn action-btn-secondary">Clear All</button>
            </div>
        `;
    }

    private _getTotalCount(): number {
        let count = 0;
        for (const items of this._selectedItems.values()) {
            count += items.length;
        }
        return count;
    }

    private _setupMessageListener(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(
            (message) => {
                if (!this._onBatchAction) {
                    return;
                }

                switch (message.command) {
                    case "batchRetrieve":
                        this._onBatchAction("batchRetrieve");
                        break;
                    case "batchDeploy":
                        this._onBatchAction("batchDeploy");
                        break;
                    case "clearSelections":
                        this._onBatchAction("clearSelections");
                        break;
                    case "removeItem":
                        this._onBatchAction("removeItem", {
                            key: message.key,
                            item: message.item,
                        });
                        break;
                }
            },
            undefined,
            this._extensionContext.subscriptions,
        );
    }
}
