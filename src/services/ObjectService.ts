import { SfCommandService } from "./SfCommandService";

export interface CustomObject {
    createdById: string;
    createdByName: string;
    createdDate: string;
    fileName: string;
    fullName: string;
    id: string;
    lastModifiedById: string;
    lastModifiedByName: string;
    lastModifiedDate: string;
    namespacePrefix: string;
    type: string;
}

export class ObjectService {
    private readonly _sfCommandService: SfCommandService;

    constructor() {
        this._sfCommandService = new SfCommandService();
    }

    /**
     * Gets all custom objects from a Salesforce org
     * @param targetOrg The target org alias or username
     * @returns {Promise<CustomObject[]>} List of custom objects
     */
    public async getCustomObjects(targetOrg: string): Promise<CustomObject[]> {
        return await this._sfCommandService.execute("sf", [
            "org",
            "list",
            "metadata",
            "--metadata-type",
            "CustomObject",
            "--target-org",
            targetOrg,
        ]);
    }
}
