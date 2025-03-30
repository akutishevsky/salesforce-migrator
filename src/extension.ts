import * as vscode from "vscode";
import {
    OrgSelectorWebview,
    OrgSelectorType,
} from "./webviews/OrgSelectorWebview";

export function activate(extensionContext: vscode.ExtensionContext) {
    try {
        const sourceOrgSelector = new OrgSelectorWebview(
            extensionContext,
            "source"
        );
        const targetOrgSelector = new OrgSelectorWebview(
            extensionContext,
            "target"
        );

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
