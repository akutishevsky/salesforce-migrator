import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { OrgSelectorWebview } from "./views/OrgSelectorView";
import { MetadataSelectorView } from "./views/MetadataSelectorView";
import { MetadataSelectionView } from "./views/MetadataSelectionView";
import { RecordsSelectorView } from "./views/RecordsSelectorView";

function checkIsSfdxProject(): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.commands.executeCommand(
            "setContext",
            "salesforce-migrator.isSfdxProject",
            false
        );
        return false;
    }

    const projectFilePath = path.join(
        workspaceFolders[0].uri.fsPath,
        "sfdx-project.json"
    );
    const isSfdxProject = fs.existsSync(projectFilePath);
    vscode.commands.executeCommand(
        "setContext",
        "salesforce-migrator.isSfdxProject",
        isSfdxProject
    );

    return isSfdxProject;
}

function createViewProviders(extensionContext: vscode.ExtensionContext) {
    const sourceOrgSelector = new OrgSelectorWebview(
        extensionContext,
        "source"
    );
    const targetOrgSelector = new OrgSelectorWebview(
        extensionContext,
        "target"
    );
    const metadataSelectorView = new MetadataSelectorView(extensionContext);
    const metadataSelectionView = new MetadataSelectionView(extensionContext);
    const recordsSelectorView = new RecordsSelectorView(extensionContext);

    // Wire the selection view to the metadata selector
    metadataSelectorView.setSelectionView(metadataSelectionView);

    return {
        sourceOrgSelector,
        targetOrgSelector,
        metadataSelectorView,
        metadataSelectionView,
        recordsSelectorView,
    };
}

function registerCommands(
    extensionContext: vscode.ExtensionContext,
    viewProviders: {
        sourceOrgSelector: OrgSelectorWebview;
        targetOrgSelector: OrgSelectorWebview;
        metadataSelectorView: MetadataSelectorView;
        metadataSelectionView: MetadataSelectionView;
        recordsSelectorView: RecordsSelectorView;
    }
) {
    const {
        sourceOrgSelector,
        targetOrgSelector,
        metadataSelectorView,
        recordsSelectorView,
    } = viewProviders;

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

    const clearWorkspaceStorageCommand = vscode.commands.registerCommand(
        "salesforce-migrator.clearWorkspaceStorage",
        async () => {
            const orgService = sourceOrgSelector.getOrgService();
            await orgService.clearOrgSelections();
            // Refresh both org selector views to update the UI
            await sourceOrgSelector.refresh();
            await targetOrgSelector.refresh();
        }
    );

    return {
        refreshSourceOrgsCommand,
        refreshTargetOrgsCommand,
        refreshMetadataCommand,
        refreshRecordsCommand,
        clearWorkspaceStorageCommand,
    };
}

function registerWebviewProviders(
    extensionContext: vscode.ExtensionContext,
    viewProviders: {
        sourceOrgSelector: OrgSelectorWebview;
        targetOrgSelector: OrgSelectorWebview;
        metadataSelectorView: MetadataSelectorView;
        metadataSelectionView: MetadataSelectionView;
        recordsSelectorView: RecordsSelectorView;
    },
    commands: {
        refreshSourceOrgsCommand: vscode.Disposable;
        refreshTargetOrgsCommand: vscode.Disposable;
        refreshMetadataCommand: vscode.Disposable;
        refreshRecordsCommand: vscode.Disposable;
        clearWorkspaceStorageCommand: vscode.Disposable;
    }
) {
    const {
        sourceOrgSelector,
        targetOrgSelector,
        metadataSelectorView,
        metadataSelectionView,
        recordsSelectorView,
    } = viewProviders;
    const {
        refreshSourceOrgsCommand,
        refreshTargetOrgsCommand,
        refreshMetadataCommand,
        refreshRecordsCommand,
        clearWorkspaceStorageCommand,
    } = commands;

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
            "salesforce-migrator.metadata-selection",
            metadataSelectionView
        ),
        vscode.window.registerWebviewViewProvider(
            "salesforce-migrator.records-selector",
            recordsSelectorView
        ),

        refreshSourceOrgsCommand,
        refreshTargetOrgsCommand,
        refreshMetadataCommand,
        refreshRecordsCommand,
        clearWorkspaceStorageCommand
    );
}

export function activate(extensionContext: vscode.ExtensionContext) {
    try {
        if (!checkIsSfdxProject()) {
            return;
        }

        const viewProviders = createViewProviders(extensionContext);
        const commands = registerCommands(extensionContext, viewProviders);
        registerWebviewProviders(extensionContext, viewProviders, commands);
    } catch (error) {
        vscode.window.showErrorMessage(
            `Failed to activate the extension: ${error}`
        );
    }
}

export function deactivate() {}
