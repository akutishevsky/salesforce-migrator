import * as vscode from "vscode";
import { SfCommandService } from "./SfCommandService";

export class OrgSelector implements vscode.WebviewViewProvider {
    private _extensionContext: vscode.ExtensionContext;
    private _sfCommandService: SfCommandService;

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
        this._sfCommandService = new SfCommandService();
    }

    public async resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): Promise<void> {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionContext.extensionUri],
        };
        const orgs = await this._sfCommandService.execute("sf org list");

        if (orgs.length === 0) {
            webviewView.webview.html = "<p>No orgs found</p>";
            return;
        }

        let html = `<div>`;
        for (const orgCategory of Object.keys(orgs)) {
            if (orgs[orgCategory].length === 0) {
                continue;
            }

            html += `<p><strong>${orgCategory}</strong></p>`;

            for (const org of orgs[orgCategory]) {
                html += `
                    <div>
                        <input type="radio" id="${org.alias}"/ >
                        <label for="${org.alias}">${org.alias}</label>
                    </div>
                `;
            }
        }
        html += "</div>";

        webviewView.webview.html = html;

        return;
    }
}
