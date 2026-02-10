import * as vscode from "vscode";
import { HtmlService, escapeHtml } from "../services/HtmlService";
import { OrgService } from "../services/OrgService";
import { MetadataService, MetadataObject } from "../services/MetadataService";
import { MetadataDeploymentWebview } from "../webviews/MetadataDeploymentWebview";
import { MetadataSelectionView } from "./MetadataSelectionView";
import { SfCommandService } from "../services/SfCommandService";

export class MetadataSelectorView implements vscode.WebviewViewProvider {
    private readonly _extensionContext: vscode.ExtensionContext;
    private _htmlService!: HtmlService;
    private _webviewView: vscode.WebviewView | undefined;
    private readonly _metadataService: MetadataService;
    private readonly _orgService: OrgService;
    private readonly _sfCommandService: SfCommandService;
    private _deploymentWebview: MetadataDeploymentWebview | undefined;
    private _metadataObjects: MetadataObject[] = [];
    private readonly _selectedItems: Map<string, string[]> = new Map();
    private _selectionView: MetadataSelectionView | undefined;

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
        this._metadataService = new MetadataService();
        this._orgService = new OrgService(extensionContext);
        this._sfCommandService = new SfCommandService();
    }

    public setSelectionView(selectionView: MetadataSelectionView): void {
        this._selectionView = selectionView;
        this._selectionView.setOnBatchAction((action, data) => {
            switch (action) {
                case "batchRetrieve":
                    this._batchRetrieve();
                    break;
                case "batchDeploy":
                    this._batchDeploy();
                    break;
                case "clearSelections":
                    this._selectedItems.clear();
                    this._updateSelectionView();
                    break;
                case "removeItem":
                    if (data) {
                        this._removeItem(data.key, data.item);
                    }
                    break;
            }
        });
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
                "No source org selected. Please select a source org first.",
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
                    this._metadataObjects =
                        await this._metadataService.fetchMetadataObjects(
                            sourceOrg,
                        );
                    this._composeWebviewHtml(this._metadataObjects);
                    vscode.window.showInformationMessage(
                        "Metadata refreshed successfully.",
                    );
                } catch (error: any) {
                    vscode.window.showErrorMessage(
                        `Failed to refresh metadata: ${error.message || error}`,
                    );
                }
            },
        );
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

        this._renderLoader();

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionContext.extensionUri],
        };

        this._deploymentWebview = new MetadataDeploymentWebview(
            this._extensionContext,
            this._webviewView,
            this._onSelectionChanged.bind(this),
        );

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            this._renderNoSourceOrg();
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first.",
            );
            return;
        }

        try {
            this._metadataObjects =
                await this._metadataService.fetchMetadataObjects(sourceOrg);

            this._composeWebviewHtml(this._metadataObjects);
            this._setupMessageListener(webviewView);
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to load metadata: ${error.message || error}`,
            );
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

        // Ensure message listener is setup after HTML is updated
        this._setupMessageListener(this._webviewView);
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
        metadataObjects: MetadataObject[],
    ): string {
        let html = `<div class="list">`;
        for (const metadataObject of metadataObjects) {
            const safeName = escapeHtml(metadataObject.xmlName);
            if (metadataObject.inFolder) {
                html += `<div class="list-item list-item-expandable" data-metadata-type="${safeName}">
                    <span class="expand-arrow">&#9654;</span>${safeName}
                </div>
                <div class="folder-children" data-metadata-type="${safeName}"></div>`;
            } else {
                html += `<div class="list-item">${safeName}</div>`;
            }
        }
        html += `</div>`;

        return html;
    }

    private _getSelectionKey(metadataType: string, folder?: string): string {
        return folder ? `${metadataType}/${folder}` : metadataType;
    }

    private _onSelectionChanged(
        metadataType: string,
        folder: string | undefined,
        selectedItems: string[],
    ): void {
        const key = this._getSelectionKey(metadataType, folder);

        if (selectedItems.length === 0) {
            this._selectedItems.delete(key);
        } else {
            this._selectedItems.set(key, selectedItems);
        }

        this._updateSelectionView();
    }

    private _removeItem(key: string, item: string): void {
        const items = this._selectedItems.get(key);
        if (!items) {
            return;
        }

        const filtered = items.filter((i) => i !== item);
        if (filtered.length === 0) {
            this._selectedItems.delete(key);
        } else {
            this._selectedItems.set(key, filtered);
        }

        this._updateSelectionView();
    }

    private _updateSelectionView(): void {
        if (this._selectionView) {
            this._selectionView.updateSelections(this._selectedItems);
        }
        this._syncDeploymentCheckboxes();
    }

    private _syncDeploymentCheckboxes(): void {
        if (!this._deploymentWebview) {
            return;
        }

        const currentType = this._deploymentWebview.currentMetadataType;
        if (!currentType) {
            return;
        }

        const key = this._getSelectionKey(
            currentType,
            this._deploymentWebview.currentFolder,
        );
        const selected = this._selectedItems.get(key) || [];
        this._deploymentWebview.updateCheckboxSelections(selected);
    }

    private _setupMessageListener(webviewView: vscode.WebviewView): void {
        webviewView.webview.onDidReceiveMessage(
            this._processWebviewMessage.bind(this),
            undefined,
            this._extensionContext.subscriptions,
        );
    }

    /**
     * Dispose the deployment webview
     */
    public dispose(): void {
        if (this._deploymentWebview) {
            this._deploymentWebview = undefined;
        }
    }

    private _processWebviewMessage(message: any): void {
        switch (message.command) {
            case "metadataSelected":
                if (
                    typeof message.metadata !== "string" ||
                    !message.metadata.trim()
                ) {
                    return;
                }
                if (!this._deploymentWebview) {
                    vscode.window.showErrorMessage(
                        "Deployment webview is not initialized.",
                    );
                    return;
                }
                {
                    const key = this._getSelectionKey(message.metadata);
                    const selected = this._selectedItems.get(key) || [];
                    this._deploymentWebview.reveal(
                        message.metadata,
                        undefined,
                        selected,
                    );
                }
                break;
            case "expandFolders":
                if (
                    typeof message.metadataType !== "string" ||
                    !message.metadataType.trim()
                ) {
                    return;
                }
                this._loadFolders(message.metadataType);
                break;
            case "folderSelected":
                if (
                    typeof message.metadataType !== "string" ||
                    !message.metadataType.trim()
                ) {
                    return;
                }
                if (
                    typeof message.folder !== "string" ||
                    !message.folder.trim()
                ) {
                    return;
                }
                if (!this._deploymentWebview) {
                    vscode.window.showErrorMessage(
                        "Deployment webview is not initialized.",
                    );
                    return;
                }
                {
                    const key = this._getSelectionKey(
                        message.metadataType,
                        message.folder,
                    );
                    const selected = this._selectedItems.get(key) || [];
                    this._deploymentWebview.reveal(
                        message.metadataType,
                        message.folder,
                        selected,
                    );
                }
                break;
        }
    }

    private async _loadFolders(metadataType: string): Promise<void> {
        if (!this._webviewView) {
            return;
        }

        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            return;
        }

        try {
            const folders = await this._metadataService.listMetadataFolders(
                sourceOrg,
                metadataType,
            );

            folders.sort((a: any, b: any) =>
                a.fullName.localeCompare(b.fullName),
            );

            this._webviewView.webview.postMessage({
                command: "foldersLoaded",
                metadataType,
                folders: folders.map((f: any) => f.fullName),
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to load folders: ${error.message || error}`,
            );
            this._webviewView.webview.postMessage({
                command: "foldersLoaded",
                metadataType,
                folders: [],
                error: error.message || String(error),
            });
        }
    }

    private static readonly METADATA_NAME_PATTERN = /^[\w.\-/]+$/;

    private _buildMetadataFlags(): string[] {
        const flags: string[] = [];
        for (const [key, items] of this._selectedItems.entries()) {
            const metadataType = key.includes("/") ? key.split("/")[0] : key;
            const folder = key.includes("/")
                ? key.split("/").slice(1).join("/")
                : undefined;

            for (const item of items) {
                if (!MetadataSelectorView.METADATA_NAME_PATTERN.test(item)) {
                    continue;
                }
                const fullName = folder ? `${folder}/${item}` : item;
                flags.push(`${metadataType}:${fullName}`);
            }
        }
        return flags;
    }

    private _collectFolderItems(): { folderFlags: string[] } {
        const folderFlags: string[] = [];

        for (const [key] of this._selectedItems.entries()) {
            if (!key.includes("/")) {
                continue;
            }
            const metadataType = key.split("/")[0];
            const folder = key.split("/").slice(1).join("/");
            const folderTypeName =
                this._metadataService.getFolderTypeName(metadataType);
            if (folderTypeName) {
                const folderFlag = `${folderTypeName}:${folder}`;
                if (!folderFlags.includes(folderFlag)) {
                    folderFlags.push(folderFlag);
                }
            }
        }

        return { folderFlags };
    }

    private async _batchRetrieve(): Promise<void> {
        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first.",
            );
            return;
        }

        const metadataFlags = this._buildMetadataFlags();
        if (metadataFlags.length === 0) {
            vscode.window.showWarningMessage("No items selected.");
            return;
        }

        const tokenSource = new vscode.CancellationTokenSource();

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Retrieving ${metadataFlags.length} metadata item(s)...`,
                cancellable: true,
            },
            async (
                progress,
                token,
            ): Promise<{ success?: boolean; error?: any }> => {
                token.onCancellationRequested(() => {
                    tokenSource.cancel();
                });

                try {
                    const mFlagArgs = metadataFlags.flatMap((f) => ["-m", f]);
                    await this._sfCommandService.execute(
                        "sf",
                        [
                            "project",
                            "retrieve",
                            "start",
                            ...mFlagArgs,
                            "--target-org",
                            sourceOrg,
                        ],
                        tokenSource.token,
                    );

                    if (tokenSource.token.isCancellationRequested) {
                        return {};
                    }

                    return { success: true };
                } catch (error: any) {
                    return { error };
                } finally {
                    tokenSource.dispose();
                }
            },
        );

        if (result.error) {
            if (result.error.message === "Operation cancelled") {
                vscode.window.showInformationMessage(
                    "Batch retrieval was cancelled.",
                );
            } else {
                vscode.window.showErrorMessage(
                    `Error during batch retrieval: ${result.error.message || result.error}`,
                );
            }
            return;
        }

        if (result.success) {
            this._selectedItems.clear();
            this._updateSelectionView();
            vscode.window.showInformationMessage(
                `Successfully retrieved ${metadataFlags.length} metadata item(s).`,
            );
        }
    }

    private async _batchDeploy(): Promise<void> {
        const sourceOrg = this._orgService.getSourceOrg();
        if (!sourceOrg) {
            vscode.window.showErrorMessage(
                "No source org selected. Please select a source org first.",
            );
            return;
        }

        const targetOrg = this._orgService.getTargetOrg();
        if (!targetOrg) {
            vscode.window.showErrorMessage(
                "No target org selected. Please select a target org first.",
            );
            return;
        }

        const metadataFlags = this._buildMetadataFlags();
        if (metadataFlags.length === 0) {
            vscode.window.showWarningMessage("No items selected.");
            return;
        }

        const { folderFlags } = this._collectFolderItems();
        const hasFolders = folderFlags.length > 0;
        const totalSteps = hasFolders ? 4 : 2;

        const tokenSource = new vscode.CancellationTokenSource();

        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Deploying ${metadataFlags.length} metadata item(s)...`,
                cancellable: true,
            },
            async (
                progress,
                token,
            ): Promise<{
                deployResult?: any;
                cancelled?: boolean;
                error?: any;
            }> => {
                token.onCancellationRequested(() => {
                    tokenSource.cancel();
                });

                try {
                    let currentStep = 1;

                    if (hasFolders) {
                        currentStep = await this._deployFolders(
                            folderFlags,
                            sourceOrg,
                            targetOrg,
                            totalSteps,
                            currentStep,
                            progress,
                            tokenSource,
                        );
                        if (tokenSource.token.isCancellationRequested) {
                            return { cancelled: true };
                        }
                    }

                    const deployResult = await this._deployItems(
                        metadataFlags,
                        sourceOrg,
                        targetOrg,
                        totalSteps,
                        currentStep,
                        progress,
                        tokenSource,
                    );
                    if (tokenSource.token.isCancellationRequested) {
                        return { cancelled: true };
                    }

                    return { deployResult };
                } catch (error: any) {
                    return { error };
                } finally {
                    tokenSource.dispose();
                }
            },
        );

        this._handleBatchDeployResult(result, metadataFlags.length);
    }

    private async _deployFolders(
        folderFlags: string[],
        sourceOrg: string,
        targetOrg: string,
        totalSteps: number,
        currentStep: number,
        progress: vscode.Progress<{ message: string }>,
        tokenSource: vscode.CancellationTokenSource,
    ): Promise<number> {
        const folderMFlagArgs = folderFlags.flatMap((f) => ["-m", f]);

        progress.report({
            message: `Step ${currentStep}/${totalSteps}: Retrieving folders from source...`,
        });
        await this._sfCommandService.execute(
            "sf",
            [
                "project",
                "retrieve",
                "start",
                ...folderMFlagArgs,
                "--target-org",
                sourceOrg,
            ],
            tokenSource.token,
        );

        if (tokenSource.token.isCancellationRequested) {
            return currentStep;
        }

        currentStep++;

        progress.report({
            message: `Step ${currentStep}/${totalSteps}: Deploying folders to target...`,
        });
        await this._sfCommandService.execute(
            "sf",
            [
                "project",
                "deploy",
                "start",
                ...folderMFlagArgs,
                "--target-org",
                targetOrg,
            ],
            tokenSource.token,
        );

        return currentStep + 1;
    }

    private async _deployItems(
        metadataFlags: string[],
        sourceOrg: string,
        targetOrg: string,
        totalSteps: number,
        currentStep: number,
        progress: vscode.Progress<{ message: string }>,
        tokenSource: vscode.CancellationTokenSource,
    ): Promise<any> {
        const mFlagArgs = metadataFlags.flatMap((f) => ["-m", f]);

        progress.report({
            message: `Step ${currentStep}/${totalSteps}: Retrieving items from source...`,
        });
        await this._sfCommandService.execute(
            "sf",
            [
                "project",
                "retrieve",
                "start",
                ...mFlagArgs,
                "--target-org",
                sourceOrg,
            ],
            tokenSource.token,
        );

        if (tokenSource.token.isCancellationRequested) {
            return undefined;
        }

        currentStep++;

        progress.report({
            message: `Step ${currentStep}/${totalSteps}: Deploying items to target...`,
        });
        return this._sfCommandService.execute(
            "sf",
            [
                "project",
                "deploy",
                "start",
                ...mFlagArgs,
                "--target-org",
                targetOrg,
            ],
            tokenSource.token,
        );
    }

    private async _handleBatchDeployResult(
        result: { deployResult?: any; cancelled?: boolean; error?: any },
        itemCount: number,
    ): Promise<void> {
        if (result.cancelled) {
            vscode.window.showInformationMessage(
                "Batch deployment was cancelled.",
            );
            return;
        }

        if (result.error) {
            if (result.error.message === "Operation cancelled") {
                vscode.window.showInformationMessage(
                    "Batch deployment was cancelled.",
                );
            } else {
                vscode.window.showErrorMessage(
                    `Error during batch deployment: ${result.error.message || result.error}`,
                );
            }
            return;
        }

        this._selectedItems.clear();
        this._updateSelectionView();

        const message = result.deployResult?.success
            ? `Successfully deployed ${itemCount} metadata item(s).`
            : `Deployment failed. Problems: ${(result.deployResult?.details?.componentFailures?.map((f: any) => f.problem) || []).join(" • ")}`;

        const showFn = result.deployResult?.success
            ? vscode.window.showInformationMessage
            : vscode.window.showErrorMessage;

        const selection = await showFn(message, "View Deploy URL");
        if (selection === "View Deploy URL" && result.deployResult?.deployUrl) {
            const deployUri = vscode.Uri.parse(result.deployResult.deployUrl);
            if (deployUri.scheme === "https") {
                vscode.env.openExternal(deployUri);
            }
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
