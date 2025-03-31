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

/**
 * Service for fetching and managing Salesforce metadata
 */
export class MetadataService {
    private _sfCommandService: SfCommandService;

    constructor() {
        this._sfCommandService = new SfCommandService();
    }

    /**
     * Lists all metadata types from a specified org
     * @param targetOrg The org alias to list metadata types from
     * @returns {Promise<Metadata>} Complete `Metadata` information from the specified org
     */
    public async listMetadataTypes(targetOrg: string): Promise<Metadata> {
        const metadata = await this._sfCommandService.execute(
            `sf org list metadata-types --target-org ${targetOrg}`
        );
        return metadata;
    }

    /**
     * Fetches metadata objects from a specified org
     * @param targetOrg The org alias to fetch metadata objects from
     * @returns {Promise<MetadataObject[]>} Array of `MetadataObject` from the specified org
     */
    public async fetchMetadataObjects(
        targetOrg: string
    ): Promise<MetadataObject[]> {
        const metadata = await this.listMetadataTypes(targetOrg);
        return metadata.metadataObjects;
    }

    /**
     * Lists all metadata of a specific type from a specified org
     * @param targetOrg The org alias to list metadata from
     * @param metadataType The type of metadata to list
     * @returns {Promise<any[]>} Array of metadata items of the specified type
     */
    public async listMetadataByType(
        targetOrg: string,
        metadataType: string
    ): Promise<any[]> {
        const metadata = await this._sfCommandService.execute(
            `sf org list metadata --target-org ${targetOrg} --metadata-type ${metadataType}`
        );
        return metadata;
    }
}
