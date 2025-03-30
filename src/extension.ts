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

        // Register commands for refreshing orgs
        const refreshSourceOrgsCommand = vscode.commands.registerCommand(
            'salesforce-migrator.refreshSourceOrgs',
            () => sourceOrgSelector.refresh()
        );
        
        const refreshTargetOrgsCommand = vscode.commands.registerCommand(
            'salesforce-migrator.refreshTargetOrgs', 
            () => targetOrgSelector.refresh()
        );

        extensionContext.subscriptions.push(
            vscode.window.registerWebviewViewProvider(
                "salesforce-migrator.source-org-selector",
                sourceOrgSelector
            ),
            vscode.window.registerWebviewViewProvider(
                "salesforce-migrator.target-org-selector",
                targetOrgSelector
            ),
            refreshSourceOrgsCommand,
            refreshTargetOrgsCommand
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to activate the extension: ${error}`
        );
    }
}

export function deactivate() {}
