import * as vscode from "vscode";
import {
    OrgSelectorWebview,
    OrgSelectorType,
} from "./webviews/OrgSelectorWebview";
import { MetadataSelectorWebview } from "./webviews/MetadataSelectorWebview";

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
        const metadataSelector = new MetadataSelectorWebview(extensionContext);

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
                metadataSelector
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
