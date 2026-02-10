import * as vscode from "vscode";
import { HtmlService, escapeHtml } from "../services/HtmlService";
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
        type: OrgSelectorType,
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

        const orgs = await this._orgService.fetchOrgs();
        this._composeWebviewHtml(orgs);

        webviewView.webview.onDidReceiveMessage(
            this._processWebviewMessage.bind(this),
        );
    }

    private _renderLoader(): void {
        if (!this._webviewView) {
            return;
        }

        this._webviewView.webview.html = this._htmlService.getLoaderHtml();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        // Clear references to release resources
        this._webviewView = undefined;
    }

    /**
     * Refresh the org list
     */
    public async refresh(): Promise<void> {
        if (!this._webviewView) {
            return;
        }

        this._renderLoader();

        // Update internal state with latest org selections from workspace storage
        this._updateOrgSelections();

        vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Refreshing ${this._type} orgs...`,
                cancellable: false,
            },
            async () => {
                const orgs = await this._orgService.fetchOrgs();
                this._composeWebviewHtml(orgs);
                vscode.window.showInformationMessage(
                    `${this._type} orgs refreshed successfully.`,
                );
            },
        );
    }

    /**
     * Update the webview with org data
     */
    private _composeWebviewHtml(orgs: Record<string, SalesforceOrg[]>): void {
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
            scripts: ["/resources/js/orgSelectorView.js"],
            styles: ["/resources/css/orgSelectorView.css"],
        });
    }

    private _composeOrgsHtml(orgs: Record<string, SalesforceOrg[]>): string {
        const selectedOrg =
            this._type === "source" ? this._sourceOrg : this._targetOrg;
        const uniqueOrgs = this._getUniqueOrgs(orgs);
        const categories = this._categorizeOrgs(uniqueOrgs);

        let html = `<div data-selector-type="${this._type}">`;

        for (const [category, categoryOrgs] of Object.entries(categories)) {
            if (categoryOrgs.length === 0) {
                continue;
            }

            html += `<p class="category-heading">${category}</p>`;
            html += this._composeOrgListHtml(categoryOrgs, selectedOrg);
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

    /**
     * Get unique orgs from the org list by removing duplicates
     */
    private _getUniqueOrgs(
        orgs: Record<string, SalesforceOrg[]>,
    ): SalesforceOrg[] {
        const flatOrgs = Object.values(orgs).flat() as SalesforceOrg[];
        return Array.from(
            new Map(flatOrgs.map((org) => [org.alias, org])).values(),
        );
    }

    /**
     * Render a list of orgs for a category
     */
    private _composeOrgListHtml(
        orgs: SalesforceOrg[],
        selectedOrg: string | undefined,
    ): string {
        return orgs
            .map((org) => {
                const isChecked = org.alias === selectedOrg ? "checked" : "";
                const isConnected = org.isScratch
                    ? !org.isExpired
                    : org.connectedStatus === "Connected";
                const statusClass = isConnected
                    ? "status-connected"
                    : "status-disconnected";
                const statusText = isConnected ? "Connected" : "Disconnected";

                return this._composeOrgHtml(
                    org,
                    isChecked,
                    statusClass,
                    statusText,
                );
            })
            .join("");
    }

    /**
     * Compose HTML for a single org
     */
    private _composeOrgHtml(
        org: SalesforceOrg,
        isChecked: string,
        statusClass: string,
        statusText: string,
    ): string {
        const orgIdentifier = org.alias || org.username;
        const safeId = escapeHtml(orgIdentifier);

        return `
            <div>
                <input type="radio"
                       id="${this._type}-${safeId}"
                       name="${this._type}-org"
                       value="${safeId}"
                       data-org-alias="${safeId}"
                       ${isChecked}/>
                <label for="${this._type}-${safeId}">
                    ${safeId}
                    <span class="${statusClass}">
                        ${statusText}
                    </span>
                </label>
            </div>
        `;
    }

    private _processWebviewMessage(message: any): void {
        switch (message.command) {
            case "orgSelected":
                if (
                    typeof message.orgAlias !== "string" ||
                    !message.orgAlias.trim()
                ) {
                    return;
                }
                const orgIdentifier = message.orgAlias;

                if (this._type === "source") {
                    this._sourceOrg = orgIdentifier;
                    this._orgService.setSourceOrg(orgIdentifier);
                } else if (this._type === "target") {
                    this._targetOrg = orgIdentifier;
                    this._orgService.setTargetOrg(orgIdentifier);
                }

                vscode.window.showInformationMessage(
                    `Selected ${this._type} org: ${orgIdentifier}`,
                );
                break;
            default:
                vscode.window.showErrorMessage(
                    `Unknown command: ${message.command}`,
                );
                break;
        }
    }

    /**
     * Get the OrgService instance
     */
    public getOrgService(): OrgService {
        return this._orgService;
    }

    /**
     * Update internal state with latest org selections
     */
    private _updateOrgSelections(): void {
        this._sourceOrg = this._orgService.getSourceOrg();
        this._targetOrg = this._orgService.getTargetOrg();
    }
}
