import * as vscode from "vscode";
import { OrgSelectorType } from "../views/OrgSelectorView";
import { SfCommandService } from "./SfCommandService";

export interface SalesforceOrg {
    accessToken: string;
    instanceUrl: string;
    orgId: string;
    username: string;
    loginUrl: string;
    clientId: string;
    isDevHub: boolean;
    instanceApiVersion: string;
    instanceApiVersionLastRetrieved: string;
    name: string;
    instanceName: string;
    namespacePrefix: string | null;
    isSandbox: boolean;
    isScratch: boolean;
    trailExpirationDate: string | null;
    tracksSource: boolean;
    alias: string;
    isDefaultDevHubUsername: boolean;
    isDefaultUsername: boolean;
    lastUsed: string;
    connectedStatus: string;
    defaultMarker: string;
}

/**
 * Service for managing Salesforce org state
 */
export class OrgService {
    private readonly _extensionContext: vscode.ExtensionContext;
    private readonly _sourceOrgKey = "salesforceMigrator.sourceOrg";
    private readonly _targetOrgKey = "salesforceMigrator.targetOrg";
    private readonly _sfCommandService: SfCommandService;

    constructor(extensionContext: vscode.ExtensionContext) {
        this._extensionContext = extensionContext;
        this._sfCommandService = new SfCommandService();
    }

    /**
     * Get the currently selected source org
     */
    public getSourceOrg(): string | undefined {
        return this._extensionContext.workspaceState.get<string>(
            this._sourceOrgKey
        );
    }

    /**
     * Get the currently selected target org
     */
    public getTargetOrg(): string | undefined {
        return this._extensionContext.workspaceState.get<string>(
            this._targetOrgKey
        );
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
        return this._extensionContext.workspaceState.update(
            this._sourceOrgKey,
            orgAlias
        );
    }

    /**
     * Set the target org
     */
    public setTargetOrg(orgAlias: string): Thenable<void> {
        return this._extensionContext.workspaceState.update(
            this._targetOrgKey,
            orgAlias
        );
    }

    /**
     * Set an org based on the selector type (source or target)
     */
    public setOrg(type: OrgSelectorType, orgAlias: string): Thenable<void> {
        return type === "source"
            ? this.setSourceOrg(orgAlias)
            : this.setTargetOrg(orgAlias);
    }

    /**
     * Fetch orgs from Salesforce CLI
     */
    public async fetchOrgs(): Promise<Record<string, SalesforceOrg[]>> {
        return await this._sfCommandService.execute("sf org list");
    }

    public async fetchOrgDetails(orgAlias: string): Promise<SalesforceOrg> {
        const orgDetails = await this._sfCommandService.execute(
            `sf org display --target-org ${orgAlias}`
        );
        return orgDetails;
    }
}
