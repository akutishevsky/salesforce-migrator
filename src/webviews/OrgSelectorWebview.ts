import * as vscode from "vscode";
import { HtmlService } from "../services/HtmlService";
import { OrgService, SalesforceOrg } from "../services/OrgService";

export type OrgSelectorType = "source" | "target";

/**
 * Webview UI component for selecting Salesforce orgs
 */
export class OrgSelectorWebview implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
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

        const orgs = await this._orgService.fetchOrgs();
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
                const orgs = await this._orgService.fetchOrgs();
                this._updateView(orgs);
                vscode.window.showInformationMessage(
                    `${this._type} orgs refreshed successfully.`
                );
            }
        );
    }

    /**
     * Update the webview with org data
     */
    private _updateView(orgs: Record<string, SalesforceOrg[]>): void {
        if (!this._webviewView) {
            return;
        }

        const orgCount = Object.values(orgs).flat().length;
        if (orgCount === 0) {
            this._webviewView.webview.html = "<p>No orgs found</p>";
            return;
        }

        this._webviewView.webview.html = this._htmlService.composeHtml({
            body: this._composeOrgsHtml(orgs),
            scripts: ["/resources/js/orgSelector.js"],
            styles: ["/resources/css/orgSelector.css"],
        });
    }

    private _composeOrgsHtml(orgs: Record<string, SalesforceOrg[]>): string {
        const selectedOrg =
            this._type === "source" ? this._sourceOrg : this._targetOrg;
        let html = `<div data-selector-type="${this._type}">`;

        const flatOrgs = Object.values(orgs).flat() as SalesforceOrg[];
        const uniqueOrgs = Array.from(
            new Map(
                flatOrgs.map((org: SalesforceOrg) => [org.alias, org])
            ).values()
        );
        const categories = this._categorizeOrgs(uniqueOrgs);

        for (const [category, categoryOrgs] of Object.entries(categories)) {
            if (categoryOrgs.length === 0) {
                continue;
            }

            html += `<p class="category-heading">${category}</p>`;

            for (const org of categoryOrgs) {
                const isChecked = org.alias === selectedOrg ? "checked" : "";
                const isConnected = org.connectedStatus === "Connected";
                const statusClass = isConnected
                    ? "status-connected"
                    : "status-disconnected";
                const statusIcon = isConnected
                    ? "codicon-check"
                    : "codicon-error";
                const statusText = isConnected ? "Connected" : "Disconnected";

                html += this._composeOrgHtml(
                    org,
                    isChecked,
                    statusClass,
                    statusIcon,
                    statusText
                );
            }
        }

        html += "</div>";
        return html;
    }

    private _categorizeOrgs(orgs: SalesforceOrg[]): {
        [key: string]: SalesforceOrg[];
    } {
        const categories: { [key: string]: SalesforceOrg[] } = {
            "DevHub Orgs": [],
            "Sandbox Orgs": [],
            "Scratch Orgs": [],
            "Other Orgs": [],
        };

        orgs.forEach((org) => {
            if (org.isDevHub) {
                categories["DevHub Orgs"].push(org);
            } else if (org.isScratch) {
                categories["Scratch Orgs"].push(org);
            } else if (org.isSandbox) {
                categories["Sandbox Orgs"].push(org);
            } else {
                categories["Other Orgs"].push(org);
            }
        });

        return categories;
    }

    private _composeOrgHtml(
        org: SalesforceOrg,
        isChecked: string,
        statusClass: string,
        statusIcon: string,
        statusText: string
    ): string {
        return `
            <div>
                <input type="radio" 
                       id="${this._type}-${org.alias}" 
                       name="${this._type}-org" 
                       value="${org.alias}" 
                       data-org-alias="${org.alias}"
                       ${isChecked}/>
                <label for="${this._type}-${org.alias}">
                    ${org.alias}
                    <span class="${statusClass}">
                        <span class="codicon ${statusIcon} status-icon"></span>
                        ${statusText}
                    </span>
                </label>
            </div>
        `;
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
