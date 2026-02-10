import { SfCommandService } from "./SfCommandService";

export interface MetadataObject {
    childXmlNames: string[];
    directoryName: string;
    inFolder: boolean;
    metaFile: boolean;
    suffix: string;
    xmlName: string;
}

export interface Metadata {
    metadataObjects: MetadataObject[];
    organizationNamespace: string;
    partialSaveAllowed: boolean;
    testRequired: boolean;
}

const FOLDER_TYPE_MAP: Record<string, string> = {
    EmailTemplate: "EmailFolder",
    Report: "ReportFolder",
    Dashboard: "DashboardFolder",
    Document: "DocumentFolder",
};

/**
 * Service for fetching and managing Salesforce metadata
 */
export class MetadataService {
    private readonly _sfCommandService: SfCommandService;

    constructor() {
        this._sfCommandService = new SfCommandService();
    }

    /**
     * Lists all metadata types from a specified org
     * @param targetOrg The org alias to list metadata types from
     * @returns {Promise<Metadata>} Complete `Metadata` information from the specified org
     */
    public async listMetadataTypes(targetOrg: string): Promise<Metadata> {
        const metadata = await this._sfCommandService.execute("sf", [
            "org",
            "list",
            "metadata-types",
            "--target-org",
            targetOrg,
        ]);
        return metadata;
    }

    /**
     * Fetches metadata objects from a specified org
     * @param targetOrg The org alias to fetch metadata objects from
     * @returns {Promise<MetadataObject[]>} Array of `MetadataObject` from the specified org
     */
    public async fetchMetadataObjects(
        targetOrg: string,
    ): Promise<MetadataObject[]> {
        const metadata = await this.listMetadataTypes(targetOrg);
        return metadata.metadataObjects;
    }

    /**
     * Returns the folder metadata type name for a given folder-based type
     * @param metadataType The metadata type name (e.g. "EmailTemplate")
     * @returns The folder type name (e.g. "EmailFolder"), or undefined if not folder-based
     */
    public getFolderTypeName(metadataType: string): string | undefined {
        return FOLDER_TYPE_MAP[metadataType];
    }

    /**
     * Lists folders for a folder-based metadata type
     * @param targetOrg The org alias to list folders from
     * @param metadataType The folder-based metadata type (e.g. "EmailTemplate")
     * @returns {Promise<any[]>} Array of folder metadata items
     */
    public async listMetadataFolders(
        targetOrg: string,
        metadataType: string,
    ): Promise<any[]> {
        const folderType = FOLDER_TYPE_MAP[metadataType];
        if (!folderType) {
            return [];
        }

        const folders = await this._sfCommandService.execute("sf", [
            "org",
            "list",
            "metadata",
            "--target-org",
            targetOrg,
            "--metadata-type",
            folderType,
        ]);
        return folders;
    }

    /**
     * Lists all metadata of a specific type from a specified org
     * @param targetOrg The org alias to list metadata from
     * @param metadataType The type of metadata to list
     * @param folder Optional folder name for folder-based metadata types
     * @returns {Promise<any[]>} Array of metadata items of the specified type
     */
    public async listMetadataByType(
        targetOrg: string,
        metadataType: string,
        folder?: string,
    ): Promise<any[]> {
        const args = [
            "org",
            "list",
            "metadata",
            "--target-org",
            targetOrg,
            "--metadata-type",
            metadataType,
        ];
        if (folder) {
            args.push("--folder", folder);
        }

        const metadata = await this._sfCommandService.execute("sf", args);
        return metadata;
    }
}
