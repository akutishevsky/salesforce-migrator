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
     * Fetches all metadata information from a specified org
     * @param targetOrg The org alias to fetch metadata from
     * @returns {Promise<Metadata>} Complete `Metadata` information from the specified org
     */
    public async fetchMetadata(targetOrg: string): Promise<Metadata> {
        const metadata = await this._sfCommandService.execute(
            `sf org list metadata-types --target-org ${targetOrg}`
        );
        return metadata;
    }

    /**
     * Fetches only metadata types from a specified org
     * @param targetOrg The org alias to fetch metadata types from
     * @returns {Promise<MetadataObject[]>} Array of `MetadataObject` from the specified org
     */
    public async fetchMetadataTypes(
        targetOrg: string
    ): Promise<MetadataObject[]> {
        const metadata = await this.fetchMetadata(targetOrg);
        return metadata.metadataObjects;
    }
}
