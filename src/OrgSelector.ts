import * as vscode from "vscode";
import { SfCommandService } from "./SfCommandService";
import { HtmlService } from "./HtmlService";

export type OrgSelectorType = "source" | "target";

export class OrgSelector implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _sfCommandService: SfCommandService;
    private _htmlService!: HtmlService;
    private _type: OrgSelectorType;
    private _sourceOrg: string | undefined;
    private _targetOrg: string | undefined;

    constructor(
        extensionContext: vscode.ExtensionContext,
        type: OrgSelectorType
    ) {
        this._extensionContext = extensionContext;
        this._type = type;

        this._sourceOrg = this._extensionContext.workspaceState.get<string>(
            "salesforceMigrator.sourceOrg"
        );
        this._targetOrg = this._extensionContext.workspaceState.get<string>(
            "salesforceMigrator.targetOrg"
        );

        this._sfCommandService = new SfCommandService();
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): Promise<void> {
        this._htmlService = new HtmlService({
            view: webviewView,
            extensionUri: this._extensionContext.extensionUri,
        });

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionContext.extensionUri],
        };

        const orgs = await this._sfCommandService.execute("sf org list");
        if (orgs.length === 0) {
            webviewView.webview.html = "<p>No orgs found</p>";
            return;
        }

        webviewView.webview.html = this._htmlService.composeHtml({
            body: this._composeOrgsHtml(orgs),
            scripts: ["/resources/js/orgSelector.js"],
        });

        webviewView.webview.onDidReceiveMessage(
            this._processWebviewMessage.bind(this)
        );
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
                    this._extensionContext.workspaceState.update(
                        "salesforceMigrator.sourceOrg",
                        orgAlias
                    );
                } else if (this._type === "target") {
                    this._targetOrg = orgAlias;
                    this._extensionContext.workspaceState.update(
                        "salesforceMigrator.targetOrg",
                        orgAlias
                    );
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
