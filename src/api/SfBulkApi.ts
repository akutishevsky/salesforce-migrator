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
    numberRecordsProcessed?: number;
    numberRecordsFailed?: number;
    totalProcessingTime?: number;
    query?: string;
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
const MAX_POLL_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const REQUEST_TIMEOUT_MS = 60_000; // 60 seconds per individual request
const SALESFORCE_ID_PATTERN = /^[a-zA-Z0-9]{15,18}$/;
const OBJECT_NAME_PATTERN = /^[a-zA-Z]\w*(__[a-z]+)?$/;
const FIELD_NAME_PATTERN = /^[a-zA-Z]\w*(__[a-z]+)?$/;

/**
 * Service for interacting with Salesforce Bulk API
 */
export class SfBulkApi {
    private _validateJobId(jobId: string): void {
        if (!SALESFORCE_ID_PATTERN.test(jobId)) {
            throw new Error("Invalid job ID format");
        }
    }

    private _validateObjectName(objectName: string): void {
        if (!OBJECT_NAME_PATTERN.test(objectName)) {
            throw new Error("Invalid object name format");
        }
    }

    private _validateFieldName(fieldName: string): void {
        if (!FIELD_NAME_PATTERN.test(fieldName)) {
            throw new Error("Invalid field name format");
        }
    }

    private _buildUrl(org: SalesforceOrg, path: string): string {
        if (!org.instanceUrl.startsWith("https://")) {
            throw new Error("Instance URL must use HTTPS");
        }
        if (!/^\d+\.\d+$/.test(org.apiVersion)) {
            throw new Error("Invalid API version format");
        }
        return `${org.instanceUrl}/services/data/v${org.apiVersion}${path}`;
    }

    /**
     * Creates a new Bulk API DML job
     */
    private static readonly VALID_DML_OPERATIONS = [
        "insert",
        "update",
        "delete",
        "upsert",
        "harddelete",
    ];

    public async createDmlJob(
        org: SalesforceOrg,
        operation: string,
        objectName: string,
        lineEnding: string = "NONE",
    ): Promise<BulkDmlJobInfo> {
        if (!SfBulkApi.VALID_DML_OPERATIONS.includes(operation.toLowerCase())) {
            throw new Error(`Invalid DML operation: ${operation}`);
        }
        this._validateObjectName(objectName);
        const url = this._buildUrl(org, "/jobs/ingest");

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        lineEnding: string = "NONE",
    ): Promise<BulkDmlJobInfo> {
        this._validateObjectName(objectName);
        this._validateFieldName(externalIdFieldName);
        const url = this._buildUrl(org, "/jobs/ingest");

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        query: string,
    ): Promise<BulkQueryJobInfo> {
        const url = this._buildUrl(org, "/jobs/query");

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
     * Gets the results of a Bulk API query job with proper pagination handling
     */
    public async getQueryJobResults(
        org: SalesforceOrg,
        jobId: string,
    ): Promise<string> {
        this._validateJobId(jobId);
        const MAX_PAGES = 100;
        const resultChunks: string[] = [];
        let hasMore = true;
        let queryLocator: string | null = null;
        let isFirstRequest = true;
        let pageCount = 0;

        while (hasMore) {
            if (++pageCount > MAX_PAGES) {
                throw new Error(
                    `Query exceeded maximum of ${MAX_PAGES} result pages`,
                );
            }
            const basePath = `/jobs/query/${jobId}/results`;
            const url: string = queryLocator
                ? this._buildUrl(
                      org,
                      `${basePath}?locator=${encodeURIComponent(queryLocator)}`,
                  )
                : this._buildUrl(org, basePath);

            const response: Response = await fetch(url, {
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

            const csvData: string = await response.text();
            const nextRecordsUrl: string | null =
                response.headers.get("Sforce-Locator");

            // For the first request, include the entire response (including headers)
            if (isFirstRequest) {
                resultChunks.push(csvData);
                isFirstRequest = false;
            } else {
                // For subsequent requests, skip the header row and append data
                const lines = csvData.split("\n");
                if (lines.length > 1) {
                    resultChunks.push(lines.slice(1).join("\n"));
                }
            }

            // Check if there are more records to fetch
            if (nextRecordsUrl && nextRecordsUrl !== "null") {
                queryLocator = nextRecordsUrl;
                hasMore = true;
            } else {
                hasMore = false;
            }
        }

        return resultChunks.join("\n");
    }

    /**
     * Checks the status of a Bulk API query job
     */
    public async getQueryJobStatus(
        org: SalesforceOrg,
        jobId: string,
    ): Promise<BulkQueryJobInfo> {
        this._validateJobId(jobId);
        const url = this._buildUrl(org, `/jobs/query/${jobId}`);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
     * Gets comprehensive information about a query job including processing statistics
     */
    public async getQueryJobInfo(
        org: SalesforceOrg,
        jobId: string,
    ): Promise<BulkQueryJobInfo> {
        this._validateJobId(jobId);
        const url = this._buildUrl(org, `/jobs/query/${jobId}`);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            method: "GET",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            return this.throwApiError(response);
        }

        const jobInfo = (await response.json()) as BulkQueryJobInfo;

        return jobInfo;
    }

    /**
     * Checks the status of a Bulk API DML job
     */
    public async getDmlJobStatus(
        org: SalesforceOrg,
        jobId: string,
    ): Promise<BulkDmlJobInfo> {
        this._validateJobId(jobId);
        const url = this._buildUrl(org, `/jobs/ingest/${jobId}`);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        jobId: string,
    ): Promise<void> {
        this._validateJobId(jobId);
        const url = this._buildUrl(org, `/jobs/query/${jobId}`);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        this._validateJobId(jobId);
        const url = this._buildUrl(org, `/jobs/ingest/${jobId}`);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        csvData: string,
    ): Promise<void> {
        this._validateJobId(jobId);
        const url = this._buildUrl(org, `/jobs/ingest/${jobId}/batches`);

        // 1. Remove BOM if present (Windows can add this)
        let normalizedCsv = csvData.replace(/^\uFEFF/, "");

        // 2. For Windows compatibility, aggressively normalize line endings to LF
        // First convert all CRLF to LF, then ensure no lone CR characters
        normalizedCsv = normalizedCsv
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n");

        // 3. Create buffer with explicit UTF-8 encoding
        const dataBuffer = Buffer.from(normalizedCsv, "utf-8");

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            method: "PUT",
            headers: {
                Authorization: `Bearer ${org.accessToken}`,
                "Content-Type": "text/csv",
                Accept: "application/json",
            },
            body: dataBuffer,
        });

        if (!response.ok) {
            return this.throwApiError(response);
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
        jobId: string,
    ): Promise<BulkDmlJobInfo> {
        this._validateJobId(jobId);
        const url = this._buildUrl(org, `/jobs/ingest/${jobId}`);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        token?: vscode.CancellationToken,
    ): Promise<string> {
        this._validateJobId(jobId);
        return new Promise<string>((resolve, reject) => {
            // Set up cancellation handling
            let isCancelled = false;
            const startTime = Date.now();
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
                                : new Error(String(error)),
                        );
                    }
                });
            }

            const checkJobStatus = async () => {
                // If already cancelled, don't continue checking
                if (isCancelled) {
                    return;
                }

                if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
                    reject(new Error("Job polling timed out after 30 minutes"));
                    return;
                }

                try {
                    const jobStatus = await this.getQueryJobInfo(org, jobId);
                    const statusMessage =
                        jobStatus.numberRecordsProcessed !== undefined
                            ? `Current job state: ${jobStatus.state} (${jobStatus.numberRecordsProcessed} records processed)`
                            : `Current job state: ${jobStatus.state}`;

                    progress.report({
                        message: statusMessage,
                    });

                    if (jobStatus.state === "JobComplete") {
                        progress.report({
                            message: `Job ${jobId} completed successfully. Retrieving results...`,
                        });
                        const results = await this.getQueryJobResults(
                            org,
                            jobId,
                        );

                        // Count the number of records retrieved (excluding header row)
                        const lines = results
                            .split("\n")
                            .filter((line) => line.trim().length > 0);
                        const recordCount = Math.max(0, lines.length - 1);

                        progress.report({
                            message: `Retrieved ${recordCount} records from the query job.`,
                        });

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
                                `Job ${jobStatus.state.toLowerCase()}: ${jobId}`,
                            ),
                        );
                        return;
                    }

                    setTimeout(checkJobStatus, INTERVAL);
                } catch (error: unknown) {
                    reject(
                        error instanceof Error
                            ? error
                            : new Error(String(error)),
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
        jobId: string,
    ): Promise<string> {
        this._validateJobId(jobId);
        const url = this._buildUrl(org, `/jobs/ingest/${jobId}/failedResults/`);

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        jobId: string,
    ): Promise<string> {
        this._validateJobId(jobId);
        const url = this._buildUrl(
            org,
            `/jobs/ingest/${jobId}/successfulResults/`,
        );

        const response = await fetch(url, {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
        token?: vscode.CancellationToken,
    ): Promise<BulkDmlJobInfo> {
        this._validateJobId(jobId);
        return new Promise<BulkDmlJobInfo>((resolve, reject) => {
            // Set up cancellation handling
            let isCancelled = false;
            const startTime = Date.now();
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
                                : new Error(String(error)),
                        );
                    }
                });
            }

            const checkJobStatus = async () => {
                // If already cancelled, don't continue checking
                if (isCancelled) {
                    return;
                }

                if (Date.now() - startTime > MAX_POLL_DURATION_MS) {
                    reject(new Error("Job polling timed out after 30 minutes"));
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
                                }`,
                            ),
                        );
                        return;
                    }

                    setTimeout(checkJobStatus, INTERVAL);
                } catch (error: unknown) {
                    reject(
                        error instanceof Error
                            ? error
                            : new Error(String(error)),
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
        if (response.status === 401) {
            throw new Error(
                "Session expired or invalid. Please re-authenticate your org by running: sf org login web --alias <your-org-alias>",
            );
        }
        let errorMessage: string;
        try {
            const error = (await response.json()) as { message?: string }[];
            errorMessage =
                error[0]?.message ||
                `HTTP ${response.status} ${response.statusText}`;
        } catch (e) {
            errorMessage = `HTTP ${response.status} ${response.statusText}`;
        }
        throw new Error(`API request failed: ${errorMessage}`);
    }
}
