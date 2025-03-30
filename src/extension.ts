import * as vscode from "vscode";
import { OrgSelector } from "./OrgSelector";

export function activate(extensionContext: vscode.ExtensionContext) {
    try {
        const sourceOrgSelector = new OrgSelector(extensionContext);

        extensionContext.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                "salesforce-migrator.source-org-selector",
                sourceOrgSelector
            )
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to activate the extension: ${error}`
        );
    }
}

export function deactivate() {}
