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
        webview.onDidReceiveMessage(
            async (message) => {
                console.log(message);
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
            },
            undefined,
            this._extensionContext.subscriptions
        );
    }

    private async _retrieveMetadata(
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string
    ): Promise<void> {
        vscode.window.showInformationMessage(
            `Retrieving metadata of type: ${metadataTypeName}`
        );

        const command = `sf project retrieve start -m ${metadataType}:${metadataTypeName} --target-org ${sourceOrg}`;
        await this._sfCommandService.execute(command);

        vscode.window.showInformationMessage(
            `Metadata of type ${metadataTypeName} retrieved successfully.`
        );
    }

    public async _deployMetadata(
        metadataType: string,
        metadataTypeName: string,
        sourceOrg: string
    ): Promise<void> {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Deploying ${metadataTypeName}...`,
            },
            async (progress) => {
                const targetOrg = this._orgService.getTargetOrg();
                if (!targetOrg) {
                    vscode.window.showErrorMessage(
                        "No target org selected. Please select a target org first."
                    );
                    return;
                }
                progress.report({
                    increment: 33,
                });

                const retrieveCommand = `sf project retrieve start -m ${metadataType}:${metadataTypeName} --target-org ${sourceOrg}`;
                await this._sfCommandService.execute(retrieveCommand);
                progress.report({
                    increment: 66,
                });

                let deployResult: any;
                try {
                    deployResult = await this._sfCommandService.execute(
                        `sf project deploy start -m ${metadataType}:${metadataTypeName} --target-org ${targetOrg}`
                    );

                    progress.report({
                        increment: 100,
                    });

                    vscode.window
                        .showInformationMessage(
                            `${metadataTypeName} deployed successfully.`,
                            "View Deploy URL"
                        )
                        .then((selection) => {
                            if (selection === "View Deploy URL") {
                                vscode.env.openExternal(
                                    deployResult?.deployUrl
                                );
                            }
                        });
                } catch (error: any) {
                    console.error("error", error);
                }
                console.log("deployResult", deployResult);
            }
        );
    }
}
