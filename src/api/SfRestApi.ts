import { SalesforceOrg } from "../services/OrgService";

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
    /**
     * Describes an object to retrieve its fields
     */
    public async describeObject(
        org: SalesforceOrg,
        objectName: string,
    ): Promise<{ fields: FieldDescription[] }> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/sobjects/${objectName}/describe/`;

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
                }`,
            );
        }

        return (await response.json()) as { fields: FieldDescription[] };
    }

    /**
     * Executes a SOQL query to count records for validation
     */
    public async queryRecordCount(
        org: SalesforceOrg,
        query: string,
    ): Promise<number> {
        // Convert the query to a COUNT query
        const countQuery = query.replace(
            /^SELECT\s+.*?\s+FROM/i,
            "SELECT COUNT() FROM",
        );

        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/query?q=${encodeURIComponent(countQuery)}`;

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
                `Failed to count records: ${
                    error[0]?.message || JSON.stringify(error)
                }`,
            );
        }

        const result = (await response.json()) as { totalSize: number };
        return result.totalSize;
    }
}
