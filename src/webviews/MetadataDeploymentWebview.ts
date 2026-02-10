import * as vscode from "vscode";
import { HtmlService, escapeHtml } from "../services/HtmlService";
import { MetadataService } from "../services/MetadataService";
import { OrgService } from "../services/OrgService";
import { SfCommandService } from "../services/SfCommandService";

export type SelectionChangedCallback = (
    metadataType: string,
    folder: string | undefined,
    selectedItems: string[],
) => void;

export class MetadataDeploymentWebview {
    private readonly _extensionContext: vscode.ExtensionContext;
    private readonly _webviewView: vscode.WebviewView;
    private readonly _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;
    private readonly _orgService!: OrgService;
    private readonly _sfCommandService!: SfCommandService;
    private readonly _metadataService!: MetadataService;
    private _messageListener: vscode.Disposable | undefined;
    private _disposables: vscode.Disposable[] = [];
    private readonly _onSelectionChanged: SelectionChangedCallback | undefined;
    private _currentMetadataType: string | undefined;
    private _currentFolder: string | undefined;

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView,
        onSelectionChanged?: SelectionChangedCallback,
    ) {
        this._extensionContext = extensionContext;
        this._webviewView = webviewView;
        this._htmlService = new HtmlService({
            view: webviewView,
            extensionUri: this._extensionContext.extensionUri,
        });
        this._orgService = new OrgService(extensionContext);
        this._sfCommandService = new SfCommandService();
        this._metadataService = new MetadataService();
        this._onSelectionChanged = onSelectionChanged;
    }

    public get currentMetadataType(): string | undefined {
        return this._currentMetadataType;
    }

    public get currentFolder(): string | undefined {
        return this._currentFolder;
    }

    public updateCheckboxSelections(selectedItems: string[]): void {
        if (this._panel) {
            this._panel.webview.postMessage({
                command: "updateSelections",
                selectedItems,
            });
        }
    }

    public async reveal(
        metadataType?: string,
        folder?: string,
        selectedItems?: string[],
    ): Promise<void> {
        this._currentMetadataType = metadataType;
        this._currentFolder = folder;

        try {
            this._initializePanel(metadataType!, folder);
            this._renderLoader();

            const sourceOrg = this._orgService.getSourceOrg();
            if (!sourceOrg) {
                vscode.window.showErrorMessage(
                    "No source org selected. Please select a source org first.",
                );
                this._disposePanel();
                return;
            }

            const targetOrg = this._orgService.getTargetOrg();
            if (!targetOrg) {
                vscode.window.showErrorMessage(
                    "No target org selected. Please select a target org first.",
                );
                this._panel!.webview.html = this._htmlService.composeHtml({
                    body: `
                        <div class="error-container">
                            <p class="error-message">
                                No target org selected. Please select a target org first.
                            </p>
                        </div>
                    `,
                    styles: ["/resources/css/metadataDeploymentWebview.css"],
                });
                return;
            }

            const metadata = await this._metadataService.listMetadataByType(
                sourceOrg,
                metadataType!,
                folder,
            );

            this._panel!.webview.html = this._htmlService.composeHtml({
                body: this._composeWebviewHtml(metadata, selectedItems || []),
                styles: ["/resources/css/metadataDeploymentWebview.css"],
                scripts: ["/resources/js/metadataDeploymentWebview.js"],
            });

            this._setupMessageListener(
                this._panel!.webview,
                metadataType!,
                sourceOrg,
                folder,
            );

            this._panel!.reveal();
        } catch (error) {
            if (this._panel) {
                this._panel.webview.html = this._htmlService.composeHtml({
                    body: `
                        <div class="error-container">
                            <p class="error-message">
                                Error while retrieving metadata: ${escapeHtml(String(error))}
                            </p>
                        </div>
                    `,
                    styles: ["/resources/css/metadataDeploymentWebview.css"],
                });
            }
            vscode.window.showErrorMessage(
                `Error while retrieving metadata: ${error}`,
            );
        }
    }

    private _initializePanel(metadataType: string, folder?: string): void {
        const webviewTitle = folder
            ? `${metadataType}/${folder} Deployment`
            : `${metadataType} Deployment`;

        if (!this._panel) {
            this._panel = vscode.window.createWebviewPanel(
                "salesforce-migrator.metadata-deployment",
                webviewTitle,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [this._extensionContext.extensionUri],
                },
            );

            // Register the panel's dispose event
            const panelDisposeListener = this._panel.onDidDispose(() => {
                this._disposePanel();
            });

            // Add to disposables
            this._disposables.push(panelDisposeListener);
        }

        this._panel.title = webviewTitle;
    }

    private _renderLoader(): void {
        this._panel!.webview.html = this._htmlService.getLoaderHtml();
    }

    private _composeWebviewHtml(
        metadata: any,
        selectedItems: string[],
    ): string {
        let html = "";

        html += `
            <div class="search-container">
                <div class="search-wrapper">
                    <span class="search-icon">&#128269;</span>
                    <input type="text" id="search" placeholder="Search..." />
                    <button class="search-clear" id="search-clear" title="Clear search">&#10005;</button>
                </div>
            </div>
            <table>
                <thead>
                    ${this._composeTableHeadHtml()}
                </thead>
                <tbody>
                    ${this._composeTableBodyHtml(metadata, selectedItems)}
                </tbody>
            </table>
        `;

        return html;
    }

    private _composeTableHeadHtml(): string {
        return `
            <tr>
                <th class="col-select"><input type="checkbox" id="select-all" title="Select All" /></th>
                <th>Action</th>
                <th>Full Name</th>
                <th>Created By</th>
                <th>Modified By</th>
                <th>Created Date</th>
                <th>Modified Date</th>
            </tr>
        `;
    }

    private _composeTableBodyHtml(
        metadata: any,
        selectedItems: string[],
    ): string {
        let html = "";

        metadata.sort((a: any, b: any) => {
            return a.fullName.localeCompare(b.fullName);
        });

        for (const item of metadata) {
            const isChecked = selectedItems.includes(item.fullName)
                ? "checked"
                : "";
            const safeFullName = escapeHtml(item.fullName);
            html += `
                <tr>
                    <td class="col-select" data-label="Select">
                        <input type="checkbox" class="item-checkbox" value="${safeFullName}" ${isChecked} />
                    </td>
                    <td data-label="Action">
                        <button class="btn-action" id="retrieve" value="${safeFullName}">Retrieve</button>
                        <button class="btn-action" id="deploy" value="${safeFullName}">Deploy</button>
                    </td>
                    <td data-label="Full Name">${safeFullName}</td>
                    <td data-label="Created By">${escapeHtml(item.createdByName)}</td>
                    <td data-label="Modified By">${escapeHtml(item.lastModifiedByName)}</td>
                    <td data-label="Created Date">
                        ${new Date(item.createdDate).toLocaleString()}
                    </td>
                    <td data-label="Modified Date">
                        ${new Date(item.lastModifiedDate).toLocaleString()}
                    </td>
                </tr>`;
        }

        return html;
    }

    private _setupMessageListener(
        webview: vscode.Webview,
        metadataType: string,
        sourceOrg: string,
        folder?: string,
    ): void {
        // Clean up previous listener if it exists
        this._clearMessageListener();

        // Create a new listener
        this._messageListener = webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case "retrieve":
                    if (
                        typeof message.metadataTypeName !== "string" ||
                        !message.metadataTypeName.trim() ||
                        !/^[\w.\-/]+$/.test(message.metadataTypeName)
                    ) {
                        return;
                    }
                    await this._retrieveMetadata(
                        metadataType,
                        message.metadataTypeName,
                        sourceOrg,
                    );
                    break;
                case "deploy":
                    if (
                        typeof message.metadataTypeName !== "string" ||
                        !message.metadataTypeName.trim() ||
                        !/^[\w.\-/]+$/.test(message.metadataTypeName)
                    ) {
                        return;
                    }
                    this._deployMetadata(
                        metadataType,
                        message.metadataTypeName,
                        sourceOrg,
                    );
                    break;
                case "selectionChanged":
                    if (this._onSelectionChanged) {
                        if (
                            !Array.isArray(message.selectedItems) ||
                            !message.selectedItems.every(
                                (item: unknown) => typeof item === "string",
                            )
                        ) {
                            return;
                        }
                        this._onSelectionChanged(
                            metadataType,
                            folder,
                            message.selectedItems,
                        );
                    }
                    break;
            }
        });

        // Add to disposables array for proper cleanup
        this._disposables.push(this._messageListener);
    }

    private async _retrieveMetadata(
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string,
    ): Promise<void> {
        const tokenSource = new vscode.CancellationTokenSource();

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Retrieving ${metadataTypeName}...`,
                cancellable: true,
            },
            async (progress, token) => {
                // Forward the cancellation token
                token.onCancellationRequested(() => {
                    tokenSource.cancel();
                });

                progress.report({ increment: 0 });

                try {
                    await this._sfCommandService.execute(
                        "sf",
                        [
                            "project",
                            "retrieve",
                            "start",
                            "-m",
                            `${metadataType}:${metadataTypeName}`,
                            "--target-org",
                            sourceOrg,
                        ],
                        tokenSource.token,
                    );

                    if (!tokenSource.token.isCancellationRequested) {
                        vscode.window.showInformationMessage(
                            `Metadata of type ${metadataTypeName} retrieved successfully.`,
                        );
                    }
                } catch (error: any) {
                    if (error.message === "Operation cancelled") {
                        vscode.window.showInformationMessage(
                            `Retrieval of ${metadataTypeName} was cancelled.`,
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `Error retrieving ${metadataTypeName}: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                } finally {
                    tokenSource.dispose();
                }
            },
        );
    }

    public async _deployMetadata(
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string,
    ): Promise<void> {
        const tokenSource = new vscode.CancellationTokenSource();

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Deploying ${metadataTypeName}...`,
                cancellable: true,
            },
            async (progress, token) => {
                // Forward the cancellation token
                token.onCancellationRequested(() => {
                    tokenSource.cancel();
                });

                const targetOrg = this._orgService.getTargetOrg();
                if (!targetOrg) {
                    vscode.window.showErrorMessage(
                        "No target org selected. Please select a target org first.",
                    );
                    return;
                }

                try {
                    const folderTypeName =
                        this._metadataService.getFolderTypeName(metadataType);
                    if (folderTypeName && metadataTypeName.includes("/")) {
                        await this._deployFolderBasedMetadata(
                            progress,
                            metadataType,
                            metadataTypeName,
                            folderTypeName,
                            sourceOrg,
                            targetOrg,
                            tokenSource.token,
                        );
                    } else {
                        await this._deployStandardMetadata(
                            progress,
                            metadataType,
                            metadataTypeName,
                            sourceOrg,
                            targetOrg,
                            tokenSource.token,
                        );
                    }
                } catch (error: any) {
                    if (error.message === "Operation cancelled") {
                        vscode.window.showInformationMessage(
                            `Deployment of ${metadataTypeName} was cancelled.`,
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `Error deploying ${metadataTypeName}: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                } finally {
                    tokenSource.dispose();
                }
            },
        );
    }

    private async _deployStandardMetadata(
        progress: vscode.Progress<{ increment?: number }>,
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string,
        targetOrg: string,
        token: vscode.CancellationToken,
    ): Promise<void> {
        await this._retrieveMetadataWithProgress(
            progress,
            metadataType,
            metadataTypeName,
            sourceOrg,
            token,
        );

        if (token.isCancellationRequested) {
            return;
        }

        const deployResult = await this._deployToTargetOrg(
            progress,
            metadataType,
            metadataTypeName,
            targetOrg,
            token,
        );

        if (!token.isCancellationRequested) {
            await this._showDeploymentResult(
                deployResult,
                metadataTypeName,
                progress,
            );
        }
    }

    private async _deployFolderBasedMetadata(
        progress: vscode.Progress<{ increment?: number }>,
        metadataType: string,
        metadataTypeName: string,
        folderTypeName: string,
        sourceOrg: string,
        targetOrg: string,
        token: vscode.CancellationToken,
    ): Promise<void> {
        const folderName = metadataTypeName.split("/")[0];

        // Step 1: Retrieve folder from source
        progress.report({ increment: 20 });
        await this._sfCommandService.execute(
            "sf",
            [
                "project",
                "retrieve",
                "start",
                "-m",
                `${folderTypeName}:${folderName}`,
                "--target-org",
                sourceOrg,
            ],
            token,
        );

        if (token.isCancellationRequested) {
            return;
        }

        // Step 2: Deploy folder to target
        progress.report({ increment: 40 });
        await this._sfCommandService.execute(
            "sf",
            [
                "project",
                "deploy",
                "start",
                "-m",
                `${folderTypeName}:${folderName}`,
                "--target-org",
                targetOrg,
            ],
            token,
        );

        if (token.isCancellationRequested) {
            return;
        }

        // Step 3: Retrieve item from source
        progress.report({ increment: 60 });
        await this._sfCommandService.execute(
            "sf",
            [
                "project",
                "retrieve",
                "start",
                "-m",
                `${metadataType}:${metadataTypeName}`,
                "--target-org",
                sourceOrg,
            ],
            token,
        );

        if (token.isCancellationRequested) {
            return;
        }

        // Step 4: Deploy item to target
        progress.report({ increment: 80 });
        const deployResult = await this._deployToTargetOrg(
            progress,
            metadataType,
            metadataTypeName,
            targetOrg,
            token,
        );

        if (!token.isCancellationRequested) {
            await this._showDeploymentResult(
                deployResult,
                metadataTypeName,
                progress,
            );
        }
    }

    private async _retrieveMetadataWithProgress(
        progress: vscode.Progress<{ increment?: number }>,
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string,
        token?: vscode.CancellationToken,
    ): Promise<void> {
        progress.report({ increment: 33 });
        await this._sfCommandService.execute(
            "sf",
            [
                "project",
                "retrieve",
                "start",
                "-m",
                `${metadataType}:${metadataTypeName}`,
                "--target-org",
                sourceOrg,
            ],
            token,
        );
    }

    private async _deployToTargetOrg(
        progress: vscode.Progress<{ increment?: number }>,
        metadataType: string,
        metadataTypeName: string,
        targetOrg: string,
        token?: vscode.CancellationToken,
    ): Promise<any> {
        progress.report({ increment: 66 });
        try {
            return await this._sfCommandService.execute(
                "sf",
                [
                    "project",
                    "deploy",
                    "start",
                    "-m",
                    `${metadataType}:${metadataTypeName}`,
                    "--target-org",
                    targetOrg,
                ],
                token,
            );
        } catch (error: any) {
            if (error.message === "Operation cancelled") {
                throw error;
            }
            throw new Error(`Error while deploying metadata: ${error}`);
        }
    }

    private async _showDeploymentResult(
        deployResult: any,
        metadataTypeName: string,
        progress: vscode.Progress<{ increment?: number }>,
    ): Promise<void> {
        progress.report({ increment: 100 });
        if (deployResult.success) {
            await this._showSuccessNotification(deployResult, metadataTypeName);
        } else {
            await this._showErrorNotification(deployResult);
        }
    }

    private async _showSuccessNotification(
        deployResult: any,
        metadataTypeName: string,
    ): Promise<void> {
        const deployMessage = `${metadataTypeName} successfully deployed.`;
        const selection = await vscode.window.showInformationMessage(
            deployMessage,
            "View Deploy URL",
        );

        if (selection === "View Deploy URL" && deployResult?.deployUrl) {
            const deployUri = vscode.Uri.parse(deployResult.deployUrl);
            if (deployUri.scheme === "https") {
                vscode.env.openExternal(deployUri);
            }
        }
    }

    private async _showErrorNotification(deployResult: any): Promise<void> {
        const componentFailures = deployResult?.details?.componentFailures;
        const problems = componentFailures.map(
            (failure: any) => failure.problem,
        );
        const deployMessage = `Failed. Problems: ${problems.join(" • ")}`;

        const selection = await vscode.window.showErrorMessage(
            deployMessage,
            "View Deploy URL",
        );

        if (selection === "View Deploy URL" && deployResult?.deployUrl) {
            const deployUri = vscode.Uri.parse(deployResult.deployUrl);
            if (deployUri.scheme === "https") {
                vscode.env.openExternal(deployUri);
            }
        }
    }

    /**
     * Clear the message listener and remove it from subscriptions
     */
    private _clearMessageListener(): void {
        if (this._messageListener) {
            this._messageListener.dispose();
            this._messageListener = undefined;
        }
    }

    /**
     * Dispose all panel resources
     */
    public dispose(): void {
        this._disposePanel();
    }

    private _disposePanel(): void {
        // Clear message listener
        this._clearMessageListener();

        // Dispose all disposables
        this._disposables.forEach((d) => d.dispose());
        this._disposables = [];

        // Clear panel reference
        this._panel = undefined;
    }
}
