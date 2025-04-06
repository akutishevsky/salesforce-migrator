import * as vscode from "vscode";
import * as path from "path";
import { HtmlService } from "../services/HtmlService";
import { OrgService } from "../services/OrgService";
import { SfRestApi } from "../api/SfRestApi";

export class RecordsMigrationDml {
    private _extensionContext: vscode.ExtensionContext;
    private _webviewView: vscode.WebviewView;
    private _customObject: string;
    private _operation: string;
    private _htmlService: HtmlService;
    private _panel: vscode.WebviewPanel | undefined;
    private _targetOrg: string | undefined;
    private _orgService: OrgService;
    private _fields: any[] = [];
    private _sfRestApi: SfRestApi;
    private _selectedSourceFile: vscode.Uri | undefined;

    constructor(
        extensionContext: vscode.ExtensionContext,
        webviewView: vscode.WebviewView,
        customObject: string,
        operation: string
    ) {
        this._extensionContext = extensionContext;
        this._webviewView = webviewView;
        this._customObject = customObject;
        this._operation = operation;
        this._htmlService = new HtmlService({
            view: webviewView,
            extensionUri: extensionContext.extensionUri,
        });
        this._orgService = new OrgService(extensionContext);
        this._sfRestApi = new SfRestApi();
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
                `Failed to compose webview panel: ${error.message}`
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
                }
            );
        }
    }

    private _renderLoader(): void {
        if (!this._panel) {
            vscode.window.showErrorMessage(
                "Webview panel is not initialized. Please try again."
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
                this._targetOrg
            );
            const objectDescription = await this._sfRestApi.describeObject(
                orgDetails,
                this._customObject
            );

            this._fields = objectDescription.fields;

            // Sort fields by label for better UX
            this._fields.sort((a: any, b: any) => {
                return a.label.localeCompare(b.label);
            });
        } catch (error: any) {
            vscode.window.showErrorMessage(
                `Failed to retrieve object fields: ${error.message}`
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
        this._panel!.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case "selectSourceFile":
                        await this._selectSourceFile();
                        break;
                    default:
                        break;
                }
            },
            undefined,
            this._extensionContext.subscriptions
        );
    }

    private async _selectSourceFile(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspacePath =
            workspaceFolders && workspaceFolders.length > 0
                ? workspaceFolders[0].uri.fsPath
                : "";

        const defaultPath = path.join(
            workspacePath,
            `salesforce-migrator/${this._customObject}`
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
            this._selectedSourceFile = selectedSourceFile[0];

            // read the file content and extract csv headers
            const fileContent = await vscode.workspace.fs.readFile(
                this._selectedSourceFile
            );
            const fileContentString = fileContent.toString();
            const csvHeaders = fileContentString
                .split("\n")[0]
                .split(",")
                .map((header: string) => header.trim().replace(/^"|"$/g, ""));

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
    }

    private _composeWebviewHtml(): string {
        let html = "";

        html += `
            <div data-object-name="${this._customObject}" data-dml-operation="${
            this._operation
        }" class="sfm-container">
                <div class="sfm-header">
                    <h1>${this._operation} ${this._customObject} Records</h1>
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
                            Select a CSV file containing the records to ${this._operation.toLowerCase()}.
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
            (field: any) => field.idLookup === true && field.name !== "Id"
        );

        idLookupFields.forEach((field: any) => {
            optionsHtml += `
                <option value="${field.name}">
                    ${field.label} (${field.name})
                </option>
            `;
        });

        const idField = this._fields.find((field: any) => field.name === "Id");
        if (idField) {
            const selected = idLookupFields.length === 0 ? "selected" : "";
            optionsHtml += `
                <option value="${idField.name}" ${selected}>
                    ${idField.label} (${idField.name})
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
}
