import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";
import { OrgService } from "../services/OrgService";
import { SfCommandService } from "../services/SfCommandService";

export class MetadataDeploymentWebview {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;
    private _orgService!: OrgService;
    private _sfCommandService!: SfCommandService;

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
    }

    public async reveal(metadataType?: string): Promise<void> {
        try {
            const webviewTitle = `${metadataType} Deployment`;

            if (!this._panel) {
                this._panel = vscode.window.createWebviewPanel(
                    "salesforce-migrator.metadata-deployment",
                    webviewTitle,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true,
                        localResourceRoots: [
                            this._extensionContext.extensionUri,
                        ],
                    }
                );

                this._panel.onDidDispose(() => {
                    this._panel = undefined;
                });
            }

            this._panel.title = webviewTitle;

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

            const metadata = await this._sfCommandService.execute(
                `sf org list metadata --target-org ${sourceOrg} --metadata-type ${metadataType}`
            );

            this._panel.webview.html = this._htmlService.composeHtml({
                body: this._composeWebviewHtml(metadata),
                styles: ["/resources/css/metadataDeploymentWebview.css"],
            });

            this._panel.reveal();
        } catch (error) {
            vscode.window.showErrorMessage(
                `Error while deploying metadata: ${error}`
            );
        }
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
                        <button>Retrieve</button>
                        <button>Deploy</button>
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
}
