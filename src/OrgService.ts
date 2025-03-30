import * as vscode from "vscode";
import { OrgSelectorType } from "./OrgSelectorWebview";

/**
 * Service for managing Salesforce org state
 */
export class OrgService {
    private readonly _extensionContext: vscode.ExtensionContext;
    private readonly _sourceOrgKey = "salesforceMigrator.sourceOrg";
    private readonly _targetOrgKey = "salesforceMigrator.targetOrg";

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
    }

    /**
     * Get the currently selected source org
     */
    public getSourceOrg(): string | undefined {
        return this._extensionContext.workspaceState.get<string>(this._sourceOrgKey);
    }

    /**
     * Get the currently selected target org
     */
    public getTargetOrg(): string | undefined {
        return this._extensionContext.workspaceState.get<string>(this._targetOrgKey);
    }

    /**
     * Get an org based on the selector type (source or target)
     */
    public getOrg(type: OrgSelectorType): string | undefined {
        return type === "source" ? this.getSourceOrg() : this.getTargetOrg();
    }

    /**
     * Set the source org
     */
    public setSourceOrg(orgAlias: string): Thenable<void> {
        return this._extensionContext.workspaceState.update(this._sourceOrgKey, orgAlias);
    }

    /**
     * Set the target org
     */
    public setTargetOrg(orgAlias: string): Thenable<void> {
        return this._extensionContext.workspaceState.update(this._targetOrgKey, orgAlias);
    }

    /**
     * Set an org based on the selector type (source or target)
     */
    public setOrg(type: OrgSelectorType, orgAlias: string): Thenable<void> {
        return type === "source" 
            ? this.setSourceOrg(orgAlias) 
            : this.setTargetOrg(orgAlias);
    }
}