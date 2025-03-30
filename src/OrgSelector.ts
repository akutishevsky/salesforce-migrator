import * as vscode from "vscode";
import { SfCommandService } from "./SfCommandService";
import { HtmlService } from "./HtmlService";

export class OrgSelector implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _sfCommandService: SfCommandService;
    private _htmlService!: HtmlService;
    private _selectedOrgAlias: string | undefined;

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
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
        let html = `<div>`;
        for (const orgCategory of Object.keys(orgs)) {
            if (orgs[orgCategory].length === 0) {
                continue;
            }

            html += `<p><strong>${orgCategory}</strong></p>`;

            for (const org of orgs[orgCategory]) {
                html += `
                    <div>
                        <input type="radio" id="${org.alias}" value="${org.alias}"/ >
                        <label for="${org.alias}">${org.alias}</label>
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
                this._selectedOrgAlias = message.orgAlias;
                break;
            default:
                vscode.window.showErrorMessage(
                    `Unknown command: ${message.command}`
                );
                break;
        }
    }
}
