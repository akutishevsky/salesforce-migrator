import * as vscode from "vscode";
import { SalesforceOrg } from "../services/OrgService";
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

export interface BulkDmlJobInfo {
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
    numberRecordsProcessed: number;
    numberRecordsFailed: number;
    errorMessage: string;
}

const INTERVAL = 1000;

/**
 * Service for interacting with Salesforce Bulk API
 */
export class SfBulkApi {
    /**
     * Creates a new Bulk API DML job
     */
    public async createDmlJob(
        org: SalesforceOrg,
        operation: string,
        objectName: string,
        lineEnding: string = "NONE"
    ): Promise<BulkDmlJobInfo> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/ingest`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                operation: operation.toLowerCase(),
                object: objectName,
                lineEnding: lineEnding,
                contentType: "CSV",
            }),
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        return (await response.json()) as BulkDmlJobInfo;
    }

    /**
     * Creates a new Bulk API upsert job
     *
     * @param org The Salesforce org where the job will be created
     * @param objectName The API name of the sObject to upsert
     * @param externalIdFieldName The external ID field to use for matching records
     * @returns Promise that resolves with the job info
     */
    public async createUpsertJob(
        org: SalesforceOrg,
        objectName: string,
        externalIdFieldName: string,
        lineEnding: string = "NONE"
    ): Promise<BulkDmlJobInfo> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/ingest`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                operation: "upsert",
                object: objectName,
                externalIdFieldName: externalIdFieldName,
                lineEnding: lineEnding,
                contentType: "CSV",
            }),
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        return (await response.json()) as BulkDmlJobInfo;
    }

    /**
     * Creates a new Bulk API query job
     */
    public async createQueryJob(
        org: SalesforceOrg,
        query: string
    ): Promise<BulkQueryJobInfo> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/query`;

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
            return this.throwApiError(response);
        }

        return (await response.json()) as BulkQueryJobInfo;
    }

    /**
     * Gets the results of a Bulk API query job
     */
    public async getQueryJobResults(
        org: SalesforceOrg,
        jobId: string
    ): Promise<string> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/query/${jobId}/results`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
                Accept: "text/csv",
            },
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        return await response.text();
    }

    /**
     * Checks the status of a Bulk API query job
     */
    public async getQueryJobStatus(
        org: SalesforceOrg,
        jobId: string
    ): Promise<BulkQueryJobInfo> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/query/${jobId}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        return (await response.json()) as BulkQueryJobInfo;
    }

    /**
     * Checks the status of a Bulk API DML job
     */
    public async getDmlJobStatus(
        org: SalesforceOrg,
        jobId: string
    ): Promise<BulkDmlJobInfo> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/ingest/${jobId}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        return (await response.json()) as BulkDmlJobInfo;
    }

    /**
     * Aborts a Bulk API query job
     */
    public async abortQueryJob(
        org: SalesforceOrg,
        jobId: string
    ): Promise<void> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/query/${jobId}`;

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                state: "Aborted",
            }),
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }
    }

    /**
     * Aborts a Bulk API DML job
     */
    public async abortDmlJob(org: SalesforceOrg, jobId: string): Promise<void> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/ingest/${jobId}`;

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                state: "Aborted",
            }),
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }
    }

    /**
     * Uploads data to a Bulk API DML job
     *
     * @param org The Salesforce org where the job exists
     * @param jobId The ID of the job to upload data to
     * @param csvData The CSV formatted data to upload
     * @returns Promise that resolves when the upload is complete
     */
    public async uploadJobData(
        org: SalesforceOrg,
        jobId: string,
        csvData: string
    ): Promise<void> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/ingest/${jobId}/batches`;

        // 1. Remove BOM if present (Windows can add this)
        let normalizedCsv = csvData.replace(/^\uFEFF/, '');
        
        // 2. For Windows compatibility, aggressively normalize line endings to LF
        // First convert all CRLF to LF, then ensure no lone CR characters
        normalizedCsv = normalizedCsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // 3. Create buffer with explicit UTF-8 encoding
        const dataBuffer = Buffer.from(normalizedCsv, 'utf-8');
        
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "text/csv",
                "Accept": "application/json"
            },
            body: dataBuffer,
        });

        if (!response.ok) {
            return this.throwApiError(response);
        } else {
            console.log("response", await response.text());
        }
    }

    /**
     * Completes a Bulk API DML job upload
     * This closes the job and changes the state to UploadComplete
     *
     * @param org The Salesforce org where the job exists
     * @param jobId The ID of the job to complete
     * @returns Promise that resolves with the job info
     */
    public async completeJobUpload(
        org: SalesforceOrg,
        jobId: string
    ): Promise<BulkDmlJobInfo> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/ingest/${jobId}`;

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                state: "UploadComplete",
            }),
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        return (await response.json()) as BulkDmlJobInfo;
    }

    /**
     * Polls a query job until it's complete and returns the results
     */
    public async pollQueryJobUntilComplete(
        org: SalesforceOrg,
        jobId: string,
        progress: vscode.Progress<{ message: string }>,
        token?: vscode.CancellationToken
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            // Set up cancellation handling
            let isCancelled = false;
            if (token) {
                token.onCancellationRequested(async () => {
                    isCancelled = true;
                    try {
                        progress.report({
                            message: `Cancelling job ${jobId}...`,
                        });
                        await this.abortQueryJob(org, jobId);
                        reject(new Error("Operation cancelled by user"));
                    } catch (error: unknown) {
                        reject(
                            error instanceof Error
                                ? error
                                : new Error(String(error))
                        );
                    }
                });
            }

            const checkJobStatus = async () => {
                // If already cancelled, don't continue checking
                if (isCancelled) {
                    return;
                }

                try {
                    const jobStatus = await this.getQueryJobStatus(org, jobId);
                    progress.report({
                        message: `Current job state: ${jobStatus.state}`,
                    });

                    if (jobStatus.state === "JobComplete") {
                        progress.report({
                            message: `Job ${jobId} completed successfully.`,
                        });
                        const results = await this.getQueryJobResults(
                            org,
                            jobId
                        );
                        resolve(results);
                        return;
                    }

                    if (
                        jobStatus.state === "Failed" ||
                        jobStatus.state === "Aborted"
                    ) {
                        progress.report({
                            message: `Job ${jobId} ${jobStatus.state.toLowerCase()}.`,
                        });
                        reject(
                            new Error(
                                `Job ${jobStatus.state.toLowerCase()}: ${jobId}`
                            )
                        );
                        return;
                    }

                    setTimeout(checkJobStatus, INTERVAL);
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

    /**
     * Gets the failed results of a Bulk API DML job
     *
     * @param org The Salesforce org where the job exists
     * @param jobId The ID of the job to get failed results from
     * @returns Promise that resolves with a CSV string of failed records
     */
    public async getFailedResults(
        org: SalesforceOrg,
        jobId: string
    ): Promise<string> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/ingest/${jobId}/failedResults/`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                Accept: "text/csv",
            },
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        return await response.text();
    }

    /**
     * Gets the successful results of a Bulk API DML job
     *
     * @param org The Salesforce org where the job exists
     * @param jobId The ID of the job to get successful results from
     * @returns Promise that resolves with a CSV string of successful records
     */
    public async getSuccessfulResults(
        org: SalesforceOrg,
        jobId: string
    ): Promise<string> {
        const url = `${org.instanceUrl}/services/data/v${org.apiVersion}/jobs/ingest/${jobId}/successfulResults/`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                Accept: "text/csv",
            },
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        return await response.text();
    }

    public async pollDmlJobUntilComplete(
        org: SalesforceOrg,
        jobId: string,
        progress: vscode.Progress<{ message: string }>,
        token?: vscode.CancellationToken
    ): Promise<BulkDmlJobInfo> {
        return new Promise<BulkDmlJobInfo>((resolve, reject) => {
            // Set up cancellation handling
            let isCancelled = false;
            if (token) {
                token.onCancellationRequested(async () => {
                    isCancelled = true;
                    try {
                        progress.report({
                            message: `Cancelling job ${jobId}...`,
                        });
                        await this.abortDmlJob(org, jobId);
                        reject(new Error("Operation cancelled by user"));
                    } catch (error: unknown) {
                        reject(
                            error instanceof Error
                                ? error
                                : new Error(String(error))
                        );
                    }
                });
            }

            const checkJobStatus = async () => {
                // If already cancelled, don't continue checking
                if (isCancelled) {
                    return;
                }

                try {
                    const jobStatus = await this.getDmlJobStatus(org, jobId);
                    progress.report({
                        message: `Current job state: ${jobStatus.state}`,
                    });

                    if (jobStatus.state === "JobComplete") {
                        progress.report({
                            message: `Job ${jobId} completed successfully.`,
                        });
                        resolve(jobStatus);
                        return;
                    }

                    if (
                        jobStatus.state === "Failed" ||
                        jobStatus.state === "Aborted"
                    ) {
                        progress.report({
                            message: `Job ${jobId} ${jobStatus.state.toLowerCase()}.`,
                        });
                        reject(
                            new Error(
                                `Job ${jobStatus.state.toLowerCase()}: ${jobId}. Error: ${
                                    jobStatus.errorMessage
                                }`
                            )
                        );
                        return;
                    }

                    setTimeout(checkJobStatus, INTERVAL);
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

    /**
     * Extracts and throws a properly formatted error from a response
     * @param response The fetch Response object
     * @throws Error with formatted message
     */
    private async throwApiError(response: Response): Promise<never> {
        let errorMessage: string;
        try {
            const error = (await response.json()) as { message?: string }[];
            errorMessage = error[0]?.message || JSON.stringify(error);
        } catch (e) {
            // If can't parse as JSON, just use the status text
            errorMessage = response.statusText;
        }
        throw new Error(`API request failed: ${errorMessage}`);
    }
}
