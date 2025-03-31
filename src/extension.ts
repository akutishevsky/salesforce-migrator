import * as vscode from "vscode";
import { OrgSelectorWebview, OrgSelectorType } from "./views/OrgSelectorView";
import { MetadataSelectorView } from "./views/MetadataSelectorView";

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
        const metadataSelectorView = new MetadataSelectorView(extensionContext);

        // Register commands for refreshing orgs
        const refreshSourceOrgsCommand = vscode.commands.registerCommand(
            "salesforce-migrator.refreshSourceOrgs",
            () => sourceOrgSelector.refresh()
        );

        const refreshTargetOrgsCommand = vscode.commands.registerCommand(
            "salesforce-migrator.refreshTargetOrgs",
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
            vscode.window.registerWebviewViewProvider(
                "salesforce-migrator.metadata-selector",
                metadataSelectorView
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
