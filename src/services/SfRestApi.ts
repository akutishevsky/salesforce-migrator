import { SalesforceOrg } from "./OrgService";

export interface FieldDescription {
    name: string;
    label: string;
    type: string;
    picklistValues?: Array<{ value: string; label: string }>;
    [key: string]: any;
}

/**
 * Service for interacting with Salesforce REST API
 */
export class SfRestApi {
    private readonly _apiVersion = "v63.0";

    /**
     * Describes an object to retrieve its fields
     */
    public async describeObject(
        org: SalesforceOrg,
        objectName: string
    ): Promise<{ fields: FieldDescription[] }> {
        const url = `${org.instanceUrl}/services/data/${this._apiVersion}/sobjects/${objectName}/describe/`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const error = (await response.json()) as { message?: string }[];
            throw new Error(
                `Failed to describe object: ${
                    error[0]?.message || JSON.stringify(error)
                }`
            );
        }

        return (await response.json()) as { fields: FieldDescription[] };
    }
}
