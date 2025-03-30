import * as vscode from "vscode";
import { SfCommandService } from "../services/SfCommandService";
import { HtmlService } from "../services/HtmlService";
import { OrgService } from "../services/OrgService";

export type OrgSelectorType = "source" | "target";

/**
 * Webview UI component for selecting Salesforce orgs
 */
export class OrgSelectorWebview implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _sfCommandService: SfCommandService;
    private _htmlService!: HtmlService;
    private _orgService: OrgService;
    private _type: OrgSelectorType;
    private _sourceOrg: string | undefined;
    private _targetOrg: string | undefined;
    private _webviewView: vscode.WebviewView | undefined;

    constructor(
        extensionContext: vscode.ExtensionContext,
        type: OrgSelectorType
    ) {
        this._extensionContext = extensionContext;
        this._type = type;
        this._orgService = new OrgService(extensionContext);

        this._sourceOrg = this._orgService.getSourceOrg();
        this._targetOrg = this._orgService.getTargetOrg();

        this._sfCommandService = new SfCommandService();
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

        const orgs = await this._fetchOrgs();
        this._updateView(orgs);

        webviewView.webview.onDidReceiveMessage(
            this._processWebviewMessage.bind(this)
        );
    }

    /**
     * Refresh the org list
     */
    public async refresh(): Promise<void> {
        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Refreshing ${this._type} orgs...`,
                cancellable: false,
            },
            async () => {
                const orgs = await this._fetchOrgs();
                this._updateView(orgs);
                vscode.window.showInformationMessage(
                    `${this._type} orgs refreshed successfully.`
                );
            }
        );
    }

    /**
     * Fetch orgs from Salesforce CLI
     */
    private async _fetchOrgs(): Promise<any> {
        return await this._sfCommandService.execute("sf org list");
    }

    /**
     * Update the webview with org data
     */
    private _updateView(orgs: any): void {
        if (!this._webviewView) {
            return;
        }

        if (orgs.length === 0) {
            this._webviewView.webview.html = "<p>No orgs found</p>";
            return;
        }

        this._webviewView.webview.html = this._htmlService.composeHtml({
            body: this._composeOrgsHtml(orgs),
            scripts: ["/resources/js/orgSelector.js"],
        });
    }

    private _composeOrgsHtml(orgs: any): string {
        const selectedOrg =
            this._type === "source" ? this._sourceOrg : this._targetOrg;

        let html = `<div data-selector-type="${this._type}">`;

        for (const orgCategory of Object.keys(orgs)) {
            if (orgs[orgCategory].length === 0) {
                continue;
            }

            html += `<p><strong>${orgCategory}</strong></p>`;

            for (const org of orgs[orgCategory]) {
                const isChecked = org.alias === selectedOrg ? "checked" : "";
                html += `
                    <div>
                        <input type="radio" 
                               id="${this._type}-${org.alias}" 
                               name="${this._type}-org" 
                               value="${org.alias}" 
                               data-org-alias="${org.alias}"
                               ${isChecked}/>
                        <label for="${this._type}-${org.alias}">${org.alias}</label>
                    </div>
                `;
            }
        }
        html += "</div>";

        return html;
    }

    private _processWebviewMessage(message: any): void {
        switch (message.command) {
            case "orgSelected":
                const orgAlias = message.orgAlias;

                if (this._type === "source") {
                    this._sourceOrg = orgAlias;
                    this._orgService.setSourceOrg(orgAlias);
                } else if (this._type === "target") {
                    this._targetOrg = orgAlias;
                    this._orgService.setTargetOrg(orgAlias);
                }

                vscode.window.showInformationMessage(
                    `Selected ${this._type} org: ${orgAlias}`
                );
                break;
            default:
                vscode.window.showErrorMessage(
                    `Unknown command: ${message.command}`
                );
                break;
        }
    }
}
