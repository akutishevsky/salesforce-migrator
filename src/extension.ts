import * as vscode from "vscode";
import { OrgSelector, OrgSelectorType } from "./OrgSelector";

export function activate(extensionContext: vscode.ExtensionContext) {
    try {
        const sourceOrgSelector = new OrgSelector(extensionContext, "source");
        const targetOrgSelector = new OrgSelector(extensionContext, "target");

        extensionContext.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                "salesforce-migrator.source-org-selector",
                sourceOrgSelector
            ),
            vscode.window.registerWebviewViewProvider(
                "salesforce-migrator.target-org-selector",
                targetOrgSelector
            )
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to activate the extension: ${error}`
        );
    }
}

export function deactivate() {}
