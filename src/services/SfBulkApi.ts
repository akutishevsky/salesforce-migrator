import * as vscode from "vscode";
import { SalesforceOrg } from "./OrgService";
import { FieldDescription } from "./SfRestApi";

export interface BulkQueryJobInfo {
    id: string;
    operation: string;
    object: string;
    createdById: string;
    createdDate: string;
    systemModstamp: string;
    state: string;
    concurrencyMode: string;
    contentType: string;
    apiVersion: string;
    lineEnding: string;
    columnDelimiter: string;
}

/**
 * Service for interacting with Salesforce Bulk API
 */
export class SfBulkApi {
    private readonly _apiVersion = "v63.0";

    /**
     * Creates a new Bulk API query job
     */
    public async createQueryJob(
        org: SalesforceOrg,
        query: string
    ): Promise<BulkQueryJobInfo> {
        const url = `${org.instanceUrl}/services/data/${this._apiVersion}/jobs/query`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                operation: "query",
                query: query,
            }),
        });

        if (!response.ok) {
            const error = (await response.json()) as { message?: string }[];
            throw new Error(
                `Failed to create query job: ${
                    error[0]?.message || JSON.stringify(error)
                }`
            );
        }

        return (await response.json()) as BulkQueryJobInfo;
    }

    /**
     * Gets the results of a Bulk API query job
     */
    public async getQueryJobResults(
        org: SalesforceOrg,
        jobId: string,
        maxRecords: number = 1000000
    ): Promise<string> {
        const url = `${org.instanceUrl}/services/data/${this._apiVersion}/jobs/query/${jobId}/results?maxRecords=${maxRecords}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
                Accept: "text/csv",
            },
        });

        if (!response.ok) {
            const error = (await response.json()) as { message?: string }[];
            throw new Error(
                `Failed to get job results: ${
                    error[0]?.message || JSON.stringify(error)
                }`
            );
        }

        return await response.text();
    }

    /**
     * Checks the status of a Bulk API query job
     */
    public async getJobStatus(
        org: SalesforceOrg,
        jobId: string
    ): Promise<BulkQueryJobInfo> {
        const url = `${org.instanceUrl}/services/data/${this._apiVersion}/jobs/query/${jobId}`;

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
                `Failed to check job status: ${
                    error[0]?.message || JSON.stringify(error)
                }`
            );
        }

        return (await response.json()) as BulkQueryJobInfo;
    }

    /**
     * Polls a job until it's complete and returns the results
     */
    public async pollJobUntilComplete(
        org: SalesforceOrg,
        jobId: string,
        interval: number = 1000,
        maxAttempts: number = 60
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            let attempts = 0;

            const checkJobStatus = async () => {
                try {
                    attempts++;
                    const jobStatus = await this.getJobStatus(org, jobId);

                    if (jobStatus.state === "JobComplete") {
                        const results = await this.getQueryJobResults(
                            org,
                            jobId
                        );
                        resolve(results);
                        return;
                    }

                    if (jobStatus.state === "Failed") {
                        reject(new Error(`Job failed: ${jobId}`));
                        return;
                    }

                    if (attempts >= maxAttempts) {
                        reject(new Error("Job polling timed out"));
                        return;
                    }

                    setTimeout(checkJobStatus, interval);
                } catch (error: unknown) {
                    reject(
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    );
                }
            };

            checkJobStatus();
        });
    }
}
