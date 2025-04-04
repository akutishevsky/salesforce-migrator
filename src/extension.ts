import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { OrgSelectorWebview } from "./views/OrgSelectorView";
import { MetadataSelectorView } from "./views/MetadataSelectorView";
import { RecordsSelectorView } from "./views/RecordsSelectorView";

export function activate(extensionContext: vscode.ExtensionContext) {
    try {
        // Check if current workspace is a Salesforce DX project
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            // Don't activate if no workspace folder
            vscode.commands.executeCommand('setContext', 'salesforce-migrator.isSfdxProject', false);
            return;
        }

        // Check for sfdx-project.json file
        const projectFilePath = path.join(workspaceFolders[0].uri.fsPath, 'sfdx-project.json');
        
        const isSfdxProject = fs.existsSync(projectFilePath);
        vscode.commands.executeCommand('setContext', 'salesforce-migrator.isSfdxProject', isSfdxProject);
        
        // Don't continue if not an SFDX project
        if (!isSfdxProject) {
            return;
        }
        
        const sourceOrgSelector = new OrgSelectorWebview(
            extensionContext,
            "source"
        );
        const targetOrgSelector = new OrgSelectorWebview(
            extensionContext,
            "target"
        );
        const metadataSelectorView = new MetadataSelectorView(extensionContext);
        const recordsSelectorView = new RecordsSelectorView(extensionContext);

        // Register commands for refreshing orgs
        const refreshSourceOrgsCommand = vscode.commands.registerCommand(
            "salesforce-migrator.refreshSourceOrgs",
            () => sourceOrgSelector.refresh()
        );

        const refreshTargetOrgsCommand = vscode.commands.registerCommand(
            "salesforce-migrator.refreshTargetOrgs",
            () => targetOrgSelector.refresh()
        );

        const refreshMetadataCommand = vscode.commands.registerCommand(
            "salesforce-migrator.refreshMetadata",
            () => metadataSelectorView.refreshMetadata()
        );

        const refreshRecordsCommand = vscode.commands.registerCommand(
            "salesforce-migrator.refreshRecords",
            () => recordsSelectorView.refreshRecords()
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
            vscode.window.registerWebviewViewProvider(
                "salesforce-migrator.records-selector",
                recordsSelectorView
            ),

            refreshSourceOrgsCommand,
            refreshTargetOrgsCommand,
            refreshMetadataCommand,
            refreshRecordsCommand
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to activate the extension: ${error}`
        );
    }
}

export function deactivate() {}
