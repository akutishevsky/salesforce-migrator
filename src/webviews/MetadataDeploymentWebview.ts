import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";
import { MetadataService } from "../services/MetadataService";
import { OrgService } from "../services/OrgService";
import { SfCommandService } from "../services/SfCommandService";

export class MetadataDeploymentWebview {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;
    private _orgService!: OrgService;
    private _sfCommandService!: SfCommandService;
    private _metadataService!: MetadataService;
    private _messageListener: vscode.Disposable | undefined;

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
        this._orgService = new OrgService(extensionContext);
        this._sfCommandService = new SfCommandService();
        this._metadataService = new MetadataService();
    }

    public async reveal(metadataType?: string): Promise<void> {
        try {
            this._initializePanel(metadataType!);

            const sourceOrg = this._orgService.getSourceOrg();
            if (!sourceOrg) {
                vscode.window.showErrorMessage(
                    "No source org selected. Please select a source org first."
                );
                return;
            }

            const targetOrg = this._orgService.getTargetOrg();
            if (!targetOrg) {
                vscode.window.showErrorMessage(
                    "No target org selected. Please select a target org first."
                );
                return;
            }

            const metadata = await this._metadataService.listMetadataByType(
                sourceOrg,
                metadataType!
            );

            this._panel!.webview.html = this._htmlService.composeHtml({
                body: this._composeWebviewHtml(metadata),
                styles: ["/resources/css/metadataDeploymentWebview.css"],
                scripts: ["/resources/js/metadataDeploymentWebview.js"],
            });

            this._setupMessageListener(
                this._panel!.webview,
                metadataType!,
                sourceOrg
            );

            this._panel!.reveal();
        } catch (error) {
            vscode.window.showErrorMessage(
                `Error while deploying metadata: ${error}`
            );
        }
    }

    private _initializePanel(metadataType: string): void {
        const webviewTitle = `${metadataType} Deployment`;

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
                // Dispose the message listener when the panel is disposed
                if (this._messageListener) {
                    this._messageListener.dispose();
                    const index = this._extensionContext.subscriptions.indexOf(
                        this._messageListener
                    );
                    if (index > -1) {
                        this._extensionContext.subscriptions.splice(index, 1);
                    }
                    this._messageListener = undefined;
                }
                this._panel = undefined;
            });
        }

        this._panel.title = webviewTitle;
    }

    private _composeWebviewHtml(metadata: any): string {
        let html = "";

        html += `
            <table>
                <thead>
                    ${this._composeTableHeadHtml(metadata)}
                </thead>
                <tbody>
                    ${this._composeTableBodyHtml(metadata)}
                </tbody>
            </table>
        `;

        return html;
    }

    private _composeTableHeadHtml(metadata: any): string {
        return `
            <tr>
                <th>Action</th>
                <th>Full Name</th>
                <th>Created By</th>
                <th>Modified By</th>
                <th>Created Date</th>
                <th>Modified Date</th>
            </tr>
        `;
    }

    private _composeTableBodyHtml(metadata: any): string {
        let html = "";

        metadata.sort((a: any, b: any) => {
            return a.fullName.localeCompare(b.fullName);
        });

        for (const item of metadata) {
            html += `
                <tr>
                    <td data-label="Action">
                        <button class="btn-action" id="retrieve" value="${
                            item.fullName
                        }">Retrieve</button>
                        <button class="btn-action" id="deploy" value="${
                            item.fullName
                        }">Deploy</button>
                    </td>
                    <td data-label="Full Name">${item.fullName}</td>
                    <td data-label="Created By">${item.createdByName}</td>
                    <td data-label="Modified By">${item.lastModifiedByName}</td>
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
        sourceOrg: string
    ): void {
        // Dispose previous listener if it exists
        if (this._messageListener) {
            this._messageListener.dispose();
            // Remove from subscriptions array if possible
            const index = this._extensionContext.subscriptions.indexOf(
                this._messageListener
            );
            if (index > -1) {
                this._extensionContext.subscriptions.splice(index, 1);
            }
        }

        // Create a new listener
        this._messageListener = webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case "retrieve":
                    await this._retrieveMetadata(
                        metadataType,
                        message.metadataTypeName,
                        sourceOrg
                    );
                    break;
                case "deploy":
                    this._deployMetadata(
                        metadataType,
                        message.metadataTypeName,
                        sourceOrg
                    );
                    break;
            }
        });

        // Add to subscriptions for auto-disposal
        this._extensionContext.subscriptions.push(this._messageListener);
    }

    private async _retrieveMetadata(
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string
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
                    const command = `sf project retrieve start -m ${metadataType}:${metadataTypeName} --target-org ${sourceOrg}`;
                    await this._sfCommandService.execute(
                        command,
                        tokenSource.token
                    );

                    if (!tokenSource.token.isCancellationRequested) {
                        vscode.window.showInformationMessage(
                            `Metadata of type ${metadataTypeName} retrieved successfully.`
                        );
                    }
                } catch (error: any) {
                    if (error.message === "Operation cancelled") {
                        vscode.window.showInformationMessage(
                            `Retrieval of ${metadataTypeName} was cancelled.`
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `Error retrieving ${metadataTypeName}: ${error}`
                        );
                    }
                } finally {
                    tokenSource.dispose();
                }
            }
        );
    }

    public async _deployMetadata(
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string
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
                        "No target org selected. Please select a target org first."
                    );
                    return;
                }

                try {
                    await this._retrieveMetadataWithProgress(
                        progress,
                        metadataType,
                        metadataTypeName,
                        sourceOrg,
                        tokenSource.token
                    );

                    if (tokenSource.token.isCancellationRequested) {
                        return;
                    }

                    const deployResult = await this._deployToTargetOrg(
                        progress,
                        metadataType,
                        metadataTypeName,
                        targetOrg,
                        tokenSource.token
                    );

                    if (!tokenSource.token.isCancellationRequested) {
                        await this._showDeploymentResult(
                            deployResult,
                            metadataTypeName,
                            progress
                        );
                    }
                } catch (error: any) {
                    if (error.message === "Operation cancelled") {
                        vscode.window.showInformationMessage(
                            `Deployment of ${metadataTypeName} was cancelled.`
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `Error deploying ${metadataTypeName}: ${error}`
                        );
                    }
                } finally {
                    tokenSource.dispose();
                }
            }
        );
    }

    private async _retrieveMetadataWithProgress(
        progress: vscode.Progress<{ increment?: number }>,
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string,
        token?: vscode.CancellationToken
    ): Promise<void> {
        progress.report({ increment: 33 });
        const retrieveCommand = `sf project retrieve start -m ${metadataType}:${metadataTypeName} --target-org ${sourceOrg}`;
        await this._sfCommandService.execute(retrieveCommand, token);
    }

    private async _deployToTargetOrg(
        progress: vscode.Progress<{ increment?: number }>,
        metadataType: string,
        metadataTypeName: string,
        targetOrg: string,
        token?: vscode.CancellationToken
    ): Promise<any> {
        progress.report({ increment: 66 });
        try {
            return await this._sfCommandService.execute(
                `sf project deploy start -m ${metadataType}:${metadataTypeName} --target-org ${targetOrg}`,
                token
            );
        } catch (error: any) {
            if (error.message === "Operation cancelled") {
                throw error;
            }
            throw Error(`Error while deploying metadata: ${error}`);
        }
    }

    private async _showDeploymentResult(
        deployResult: any,
        metadataTypeName: string,
        progress: vscode.Progress<{ increment?: number }>
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
        metadataTypeName: string
    ): Promise<void> {
        const deployMessage = `${metadataTypeName} successfully deployed.`;
        const selection = await vscode.window.showInformationMessage(
            deployMessage,
            "View Deploy URL"
        );

        if (selection === "View Deploy URL") {
            vscode.env.openExternal(deployResult?.deployUrl);
        }
    }

    private async _showErrorNotification(deployResult: any): Promise<void> {
        const componentFailures = deployResult?.details?.componentFailures;
        const problems = componentFailures.map(
            (failure: any) => failure.problem
        );
        const deployMessage = `Failed. Problems: ${problems.join(" • ")}`;

        const selection = await vscode.window.showErrorMessage(
            deployMessage,
            "View Deploy URL"
        );

        if (selection === "View Deploy URL") {
            vscode.env.openExternal(deployResult?.deployUrl);
        }
    }
}
