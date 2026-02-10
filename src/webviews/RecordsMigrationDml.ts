import * as vscode from "vscode";
import * as path from "node:path";
import { HtmlService, escapeHtml } from "../services/HtmlService";
import { OrgService, SalesforceOrg } from "../services/OrgService";
import { SfRestApi } from "../api/SfRestApi";
import { SfBulkApi, BulkDmlJobInfo } from "../api/SfBulkApi";
import { parse as csvParse } from "csv-parse/sync";
import { stringify as csvStringify } from "csv-stringify/sync";

export class RecordsMigrationDml {
    private _extensionContext: vscode.ExtensionContext;
    private _customObject: string;
    private _operation: string;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;
    private _disposables: vscode.Disposable[] = [];
    private _targetOrg: string | undefined;
    private _orgService: OrgService;
    private _fields: any[] = [];
    private _sfRestApi: SfRestApi;
    private _sfBulkApi: SfBulkApi;
    private _selectedSourceFile: vscode.Uri | undefined;
    private _mappedCsv!: string;
    private _detectedLineEnding: string = "LF";

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView,
        customObject: string,
        operation: string,
    ) {
        this._extensionContext = extensionContext;
        this._customObject = customObject;
        this._operation = operation;
        this._htmlService = new HtmlService({
            view: webviewView,
            extensionUri: extensionContext.extensionUri,
        });
        this._orgService = new OrgService(extensionContext);
        this._sfRestApi = new SfRestApi();
        this._sfBulkApi = new SfBulkApi();
    }

    public async reveal(): Promise<void> {
        try {
            this._initializePanel();
            this._renderLoader();

            this._targetOrg = this._orgService.getTargetOrg();
            if (!this._targetOrg) {
                this._panel!.dispose();
                throw new Error("Target org is not defined");
            }

            await this._retrieveFields();

            this._renderWebview();
            this._setupMessageHandlers();
            this._panel!.reveal();
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to compose webview panel: ${error.message}`,
            );
            return;
        }
    }

    private _initializePanel(): void {
        if (!this._panel) {
            this._panel = vscode.window.createWebviewPanel(
                "salesforce-migrator.records-migration-dml",
                `${this._operation} ${this._customObject} Records`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    localResourceRoots: [this._extensionContext.extensionUri],
                },
            );

            // Register the panel's dispose event
            const panelDisposeListener = this._panel.onDidDispose(() => {
                this._disposePanel();
            });

            // Add to disposables
            this._disposables.push(panelDisposeListener);
        }
    }

    private _renderLoader(): void {
        if (!this._panel) {
            vscode.window.showErrorMessage(
                "Webview panel is not initialized. Please try again.",
            );
            return;
        }
        this._panel!.webview.html = this._htmlService.getLoaderHtml();
    }

    private async _retrieveFields(): Promise<void> {
        if (!this._targetOrg) {
            throw new Error("Target org is not defined");
        }

        try {
            const orgDetails = await this._orgService.fetchOrgDetails(
                this._targetOrg,
            );
            const objectDescription = await this._sfRestApi.describeObject(
                orgDetails,
                this._customObject,
            );

            this._fields = objectDescription.fields;

            // Sort fields by label for better UX
            this._fields.sort((a: any, b: any) => {
                return a.label.localeCompare(b.label);
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to retrieve object fields: ${error.message}`,
            );
            throw error;
        }
    }

    private _renderWebview(): void {
        this._panel!.webview.html = this._htmlService.composeHtml({
            body: this._composeWebviewHtml(),
            title: `${this._operation} ${this._customObject} Records`,
            styles: ["/resources/css/recordsMigration.css"],
            scripts: ["/resources/js/recordsMigrationDml.js"],
        });
    }

    private _setupMessageHandlers(): void {
        const messageHandler = this._panel!.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case "selectSourceFile":
                        await this._selectSourceFile();
                        break;
                    case "performDmlAction":
                        if (
                            !Array.isArray(message.mapping) ||
                            !message.mapping.every(
                                (pair: unknown) =>
                                    Array.isArray(pair) &&
                                    pair.length === 2 &&
                                    typeof pair[0] === "string" &&
                                    typeof pair[1] === "string",
                            )
                        ) {
                            return;
                        }
                        if (
                            message.matchingField !== undefined &&
                            typeof message.matchingField !== "string"
                        ) {
                            return;
                        }
                        await this._performDmlAction(
                            message.mapping,
                            message.matchingField,
                        );
                        break;
                    default:
                        break;
                }
            },
        );

        // Add to disposables for proper cleanup
        this._disposables.push(messageHandler);
    }

    public async revealWithFile(filePath: string): Promise<void> {
        try {
            this._initializePanel();
            this._renderLoader();

            this._targetOrg = this._orgService.getTargetOrg();
            if (!this._targetOrg) {
                this._panel!.dispose();
                throw new Error("Target org is not defined");
            }

            await this._retrieveFields();

            this._renderWebview();
            this._setupMessageHandlers();
            this._panel!.reveal();

            await this._loadSourceFile(filePath);
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to compose webview panel: ${error.message}`,
            );
            return;
        }
    }

    private async _selectSourceFile(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath =
            workspaceFolders && workspaceFolders.length > 0
                ? workspaceFolders[0].uri.fsPath
                : "";

        const defaultPath = path.join(
            workspacePath,
            `salesforce-migrator/${this._customObject}`,
        );

        const selectedSourceFile = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                CSV: ["csv"],
            },
            openLabel: "Select",
            title: "Select Source CSV File",
            defaultUri: vscode.Uri.file(defaultPath),
        });

        if (selectedSourceFile) {
            await this._loadSourceFile(selectedSourceFile[0].fsPath);
        }
    }

    private async _loadSourceFile(filePath: string): Promise<void> {
        this._selectedSourceFile = vscode.Uri.file(filePath);

        const MAX_CSV_SIZE = 150 * 1024 * 1024; // 150 MB (Salesforce Bulk API 2.0 limit)
        const fileStat = await vscode.workspace.fs.stat(
            this._selectedSourceFile,
        );
        if (fileStat.size > MAX_CSV_SIZE) {
            vscode.window.showErrorMessage(
                `CSV file exceeds the 150 MB Salesforce Bulk API limit (${(fileStat.size / 1024 / 1024).toFixed(1)} MB).`,
            );
            this._selectedSourceFile = undefined;
            return;
        }

        // read the file content and extract csv headers
        const fileContent = await vscode.workspace.fs.readFile(
            this._selectedSourceFile,
        );
        const fileContentString = fileContent.toString();

        // Use the csv-parse library to properly parse the CSV
        const parsedCsv = csvParse(fileContentString, {
            columns: false,
            skip_empty_lines: true,
            relax_quotes: true,
        });

        // Extract the first row which contains headers
        const csvHeaders = parsedCsv.length > 0 ? parsedCsv[0] : [];

        const fieldLabels = this._fields.map((field: any) => field.label);
        const fieldNames = this._fields.map((field: any) => field.name);
        const fields = fieldLabels.map((label: string, index: number) => {
            return {
                label: label,
                name: fieldNames[index],
            };
        });

        this._panel!.webview.postMessage({
            command: "setSourceFile",
            filePath: this._selectedSourceFile.fsPath,
            csvHeaders: csvHeaders,
            fields: fields,
        });
    }

    private async _performDmlAction(
        mapping: [string, string][],
        matchingField: string,
    ): Promise<void> {
        // Validate that a CSV file was selected
        if (!this._selectedSourceFile) {
            vscode.window.showErrorMessage(
                "Please select a CSV file before performing the DML action.",
            );
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Performing ${this._operation} on ${this._customObject} Records`,
                cancellable: true,
            },
            async (progress, token) => {
                try {
                    if (token.isCancellationRequested) {
                        throw new Error("Operation cancelled by user");
                    }

                    await this._applyCsvHeadersMapping(mapping);
                    progress.report({
                        message: `Formatted the CSV file (detected ${this._detectedLineEnding} line endings)`,
                    });
                    if (token.isCancellationRequested) {
                        throw new Error("Operation cancelled by user");
                    }

                    const targetOrg = await this._orgService.fetchOrgDetails(
                        this._targetOrg!,
                    );
                    if (!targetOrg) {
                        vscode.window.showErrorMessage(
                            "Target org is not defined",
                        );
                        return;
                    }

                    if (token.isCancellationRequested) {
                        throw new Error("Operation cancelled by user");
                    }

                    const jobInfo =
                        this._operation === "Upsert"
                            ? await this._sfBulkApi.createUpsertJob(
                                  targetOrg,
                                  this._customObject,
                                  matchingField,
                                  "LF", // Force LF line ending for consistency
                              )
                            : await this._sfBulkApi.createDmlJob(
                                  targetOrg,
                                  this._operation,
                                  this._customObject,
                                  "LF", // Force LF line ending for consistency
                              );
                    progress.report({
                        message: `Created the ${this._operation} job with Id: ${jobInfo.id}`,
                    });

                    if (token.isCancellationRequested) {
                        await this._sfBulkApi.abortDmlJob(
                            targetOrg,
                            jobInfo.id,
                        );
                        throw new Error("Operation cancelled by user");
                    }

                    await this._sfBulkApi.uploadJobData(
                        targetOrg,
                        jobInfo.id,
                        this._mappedCsv,
                    );
                    progress.report({
                        message: `Started uploading ${this._operation} job data`,
                    });
                    if (token.isCancellationRequested) {
                        await this._sfBulkApi.abortDmlJob(
                            targetOrg,
                            jobInfo.id,
                        );
                        throw new Error("Operation cancelled by user");
                    }

                    await this._sfBulkApi.completeJobUpload(
                        targetOrg,
                        jobInfo.id,
                    );
                    progress.report({
                        message: `Completed uploading ${this._operation} job data`,
                    });

                    // Check if cancelled after completing job upload
                    if (token.isCancellationRequested) {
                        await this._sfBulkApi.abortDmlJob(
                            targetOrg,
                            jobInfo.id,
                        );
                        throw new Error("Operation cancelled by user");
                    }

                    const jobResult =
                        await this._sfBulkApi.pollDmlJobUntilComplete(
                            targetOrg,
                            jobInfo.id,
                            progress,
                            token,
                        );

                    await this._saveFailedRecords(jobInfo, targetOrg, progress);

                    await this._saveSuccessfulRecords(
                        jobInfo,
                        targetOrg,
                        progress,
                    );

                    vscode.window.showInformationMessage(
                        `The ${this._operation} job is completed with state: ${jobResult.state}. Records processed: ${jobResult.numberRecordsProcessed}.`,
                    );
                } catch (error: any) {
                    vscode.window.showErrorMessage(error.message);
                }
            },
        );
    }

    private async _applyCsvHeadersMapping(
        mapping: [string, string][],
    ): Promise<void> {
        const fileContentString = await this._validateAndLoadFile();
        this._detectAndSetLineEndings(fileContentString);

        if (this._operation === "Delete") {
            this._mappedCsv = fileContentString;
            return;
        }

        const parsedCsv = this._parseCsvContent(fileContentString);
        const { headerToFieldMap, headerIndicesToKeep } =
            this._createMappingStructures(parsedCsv[0], mapping);
        const processedRows = this._processRowsWithMapping(
            parsedCsv,
            headerIndicesToKeep,
            headerToFieldMap,
        );

        // Always use LF line endings for consistency with job settings
        this._mappedCsv = csvStringify(processedRows, {
            record_delimiter: "\n",
        });
    }

    private async _validateAndLoadFile(): Promise<string> {
        if (!this._selectedSourceFile) {
            throw new Error(
                "No source file selected. Please select a CSV file before proceeding.",
            );
        }

        const fileContent = await vscode.workspace.fs.readFile(
            this._selectedSourceFile,
        );

        return fileContent.toString();
    }

    private _detectAndSetLineEndings(fileContent: string): void {
        const hasCRLF = fileContent.includes("\r\n");
        this._detectedLineEnding = hasCRLF ? "CRLF" : "LF";
    }

    private _parseCsvContent(fileContent: string): string[][] {
        const parsedCsv = csvParse(fileContent, {
            columns: false,
            skip_empty_lines: true,
            relax_quotes: true,
        });

        if (parsedCsv.length === 0) {
            throw new Error("No data found in the CSV file");
        }

        return parsedCsv;
    }

    private _createMappingStructures(
        csvHeaders: string[],
        mapping: [string, string][],
    ): {
        headerToFieldMap: Map<string, string>;
        headerIndicesToKeep: number[];
    } {
        const headerToFieldMap = new Map<string, string>();
        const mappedHeaders = new Set<string>();

        mapping.forEach(([header, field]) => {
            headerToFieldMap.set(header, field);
            mappedHeaders.add(header);
        });

        // Get indices of headers that have mappings
        const headerIndicesToKeep: number[] = [];
        csvHeaders.forEach((header: string, index: number) => {
            if (mappedHeaders.has(header)) {
                headerIndicesToKeep.push(index);
            }
        });

        return { headerToFieldMap, headerIndicesToKeep };
    }

    private _processRowsWithMapping(
        parsedCsv: string[][],
        headerIndicesToKeep: number[],
        headerToFieldMap: Map<string, string>,
    ): string[][] {
        // Process each row to keep only mapped columns
        const processedRows = parsedCsv.map((row: string[]) => {
            return headerIndicesToKeep.map((index) => {
                // Handle potential undefined values in rows that have fewer columns
                return index < row.length ? row[index] : "";
            });
        });

        // Replace headers with field names in the first row
        if (processedRows.length > 0) {
            processedRows[0] = processedRows[0].map((header: string) => {
                return headerToFieldMap.get(header) || header;
            });
        }

        return processedRows;
    }

    private async _saveFailedRecords(
        jobInfo: BulkDmlJobInfo,
        targetOrg: SalesforceOrg,
        progress: vscode.Progress<{ message: string }>,
    ): Promise<void> {
        progress.report({
            message: `Getting failed results for job ${jobInfo.id}...`,
        });

        try {
            const failedResults = await this._sfBulkApi.getFailedResults(
                targetOrg,
                jobInfo.id,
            );

            const filePath = await this._saveRecordsToFile(
                failedResults,
                "Failed",
            );

            vscode.window
                .showInformationMessage(
                    `Failed records saved to ${filePath}`,
                    { modal: false },
                    "Show File",
                )
                .then((selection) => {
                    if (selection === "Show File") {
                        vscode.workspace
                            .openTextDocument(vscode.Uri.file(filePath))
                            .then((doc) => vscode.window.showTextDocument(doc));
                    }
                });
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Job completed but failed to retrieve failed records: ${error.message}`,
            );
        }
    }

    private async _saveSuccessfulRecords(
        jobInfo: BulkDmlJobInfo,
        targetOrg: SalesforceOrg,
        progress: vscode.Progress<{ message: string }>,
    ): Promise<void> {
        try {
            progress.report({
                message: `Getting successful results for job ${jobInfo.id}...`,
            });

            const successfulResults =
                await this._sfBulkApi.getSuccessfulResults(
                    targetOrg,
                    jobInfo.id,
                );

            const filePath = await this._saveRecordsToFile(
                successfulResults,
                "Succeeded",
            );

            vscode.window
                .showInformationMessage(
                    `Successful records saved to ${filePath}`,
                    { modal: false },
                    "Show File",
                )
                .then((selection) => {
                    if (selection === "Show File") {
                        vscode.workspace
                            .openTextDocument(vscode.Uri.file(filePath))
                            .then((doc) => vscode.window.showTextDocument(doc));
                    }
                });
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Job completed but failed to retrieve successful records: ${error.message}`,
            );
        }
    }

    private async _saveRecordsToFile(
        content: string,
        status: "Failed" | "Succeeded",
    ): Promise<string> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath =
            workspaceFolders && workspaceFolders.length > 0
                ? workspaceFolders[0].uri.fsPath
                : "";

        const now = new Date();
        const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(" ")[0].replaceAll(":", "-"); // HH-MM-SS

        if (/[\/\\]|\.\./.test(this._customObject)) {
            throw new Error("Invalid object name");
        }

        if (/[\/\\]|\.\./.test(this._operation)) {
            throw new Error("Invalid operation name");
        }

        const dirPath = path.join(
            workspacePath,
            `salesforce-migrator/${this._customObject}/${this._operation}/${status}`,
        );

        const resolvedDir = path.resolve(dirPath);
        if (
            workspacePath &&
            !resolvedDir.startsWith(workspacePath + path.sep) &&
            resolvedDir !== workspacePath
        ) {
            throw new Error("Output path must be within the workspace folder.");
        }

        await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));

        const filePath = path.join(
            dirPath,
            `${this._customObject}_${dateStr}_${timeStr}.csv`,
        );

        await vscode.workspace.fs.writeFile(
            vscode.Uri.file(filePath),
            Buffer.from(content),
        );

        return filePath;
    }

    private _composeWebviewHtml(): string {
        let html = "";

        const safeOperation = escapeHtml(this._operation);
        const safeObject = escapeHtml(this._customObject);
        const safeOrg = escapeHtml(this._targetOrg || "");
        const heading =
            this._operation === "Delete"
                ? `${safeOperation} ${safeObject} records from <span class="org-name">${safeOrg}</span> org`
                : `${safeOperation} ${safeObject} records to <span class="org-name">${safeOrg}</span> org`;

        html += `
            <div data-object-name="${safeObject}" data-dml-operation="${safeOperation}" class="sfm-container">
                <div class="sfm-header">
                    <h1>${heading}</h1>
                </div>
                <div class="sfm-content">
                        ${this._composeFileSelectorsHtml()}
                        ${this._composeMatchingFieldSelectorHtml()}
                        ${this._composeMappingHtml()}
                        ${this._composeDmlActionButtonHtml()}
                </div>
            </div>
        `;

        return html;
    }

    private _composeFileSelectorsHtml(): string {
        return `
            <div class="sfm-panel">
                <div class="sfm-panel-header">
                     <h2>Select file to import from</h2>
                </div>
                <div class="sfm-panel-content">
                    <div class="sfm-file-selector">
                        <label for="source-file" class="sfm-label">Source file:</label>
                        <div class="sfm-file-input-container">
                            <input 
                                type="text" 
                                id="source-file" 
                                class="sfm-file-input" 
                                placeholder="Enter CSV file path or click Browse" 
                            />
                            <button id="browse-file-button" class="sfm-button">Browse</button>
                        </div>
                        <p class="sfm-file-hint">
                            Select a CSV file containing the records to ${escapeHtml(this._operation.toLowerCase())}.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    private _composeMatchingFieldSelectorHtml(): string {
        if (this._operation !== "Upsert") {
            return "";
        }

        return `
            <div class="sfm-panel">
                <h2>Select matching field</h2>
                <div class="sfm-panel-content">
                    <div class="sfm-matching-field-selector">
                        <label for="matching-field" class="sfm-label">Matching field:</label>
                        <select id="matching-field" class="sfm-select">
                            ${this._composeMatchingFieldSelectorOptionsHtml()}
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    private _composeMatchingFieldSelectorOptionsHtml(): string {
        let optionsHtml = "";

        const idLookupFields = this._fields.filter(
            (field: any) => field.idLookup === true && field.name !== "Id",
        );

        idLookupFields.forEach((field: any) => {
            const safeName = escapeHtml(field.name);
            const safeLabel = escapeHtml(field.label);
            optionsHtml += `
                <option value="${safeName}">
                    ${safeLabel} (${safeName})
                </option>
            `;
        });

        const idField = this._fields.find((field: any) => field.name === "Id");
        if (idField) {
            const selected = idLookupFields.length === 0 ? "selected" : "";
            const safeName = escapeHtml(idField.name);
            const safeLabel = escapeHtml(idField.label);
            optionsHtml += `
                <option value="${safeName}" ${selected}>
                    ${safeLabel} (${safeName})
                </option>
            `;
        }

        return optionsHtml;
    }

    private _composeMappingHtml(): string {
        return `
            <div id="sfm-mapping" class="sfm-panel sfm-hidden">
                <h2>CSV Headers to Salesforce Fields mapping</h2>
                <div class="sfm-panel-content">
                    <div class="sfm-mapping-container">
                        <!-- 
                            Mapping table will be dynamically rendered 
                            in the recordsMigrationDml.js when the import file is provied    
                        -->
                    </div>
                </div>
            </div>
        `;
    }

    private _composeDmlActionButtonHtml(): string {
        let html = `
            <div class="sfm-panel sfm-panel-actions">
                <div class="sfm-action-container">
                    <div id="error-message" class="sfm-error-message"></div>
                    <button id="action-button" class="sfm-button sfm-button-primary">
                        ${this._operation}
                    </button>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Dispose all panel resources
     */
    private _disposePanel(): void {
        // Dispose all disposables
        this._disposables.forEach((d) => d.dispose());
        this._disposables = [];

        // Clear panel reference
        this._panel = undefined;
    }
}
