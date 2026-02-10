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
    private _buildUrl(org: SalesforceOrg, path: string): string {
        if (!org.instanceUrl.startsWith("https://")) {
            throw new Error("Instance URL must use HTTPS");
        }
        return `${org.instanceUrl}/services/data/v${org.apiVersion}${path}`;
    }

    /**
     * Describes an object to retrieve its fields
     */
    public async describeObject(
        org: SalesforceOrg,
        objectName: string,
    ): Promise<{ fields: FieldDescription[] }> {
        const url = this._buildUrl(org, `/sobjects/${objectName}/describe/`);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            let errorMessage: string;
            try {
                const error = (await response.json()) as {
                    message?: string;
                }[];
                errorMessage =
                    error[0]?.message ||
                    `HTTP ${response.status} ${response.statusText}`;
            } catch (e) {
                errorMessage = `HTTP ${response.status} ${response.statusText}`;
            }
            throw new Error(`Failed to describe object: ${errorMessage}`);
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

        const url = this._buildUrl(
            org,
            `/query?q=${encodeURIComponent(countQuery)}`,
        );

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            let errorMessage: string;
            try {
                const error = (await response.json()) as {
                    message?: string;
                }[];
                errorMessage =
                    error[0]?.message ||
                    `HTTP ${response.status} ${response.statusText}`;
            } catch (e) {
                errorMessage = `HTTP ${response.status} ${response.statusText}`;
            }
            throw new Error(`Failed to count records: ${errorMessage}`);
        }

        const result = (await response.json()) as { totalSize: number };
        return result.totalSize;
    }
}
