const vscode = acquireVsCodeApi();

let whereClausePopulator;
let query;
let fieldSelector;
let fileSelector;
let recordsExporter;
let queryCopier;
let exportedFilePath = null;

class FieldSelector {
    fieldElements = [];
    addAllButton;
    clearAllButton;
    filterInput;
    fieldsContainer;

    constructor() {
        this.fieldElements = document.querySelectorAll(
            ".sfm-field-item > input[type='checkbox']",
        );
        this.addAllButton = document.querySelector("#add-all-fields");
        this.clearAllButton = document.querySelector("#clear-all-fields");
        this.filterInput = document.querySelector(".sfm-filter > input");
        this.fieldsContainer = document.querySelector(".sfm-fields-container");

        this._addEventListeners();
    }

    _addEventListeners() {
        this._setupFieldCheckboxListener();
        this._addAll();
        this._clearAll();
        this._filterFields();
    }

    _setupFieldCheckboxListener() {
        this.fieldsContainer.addEventListener("change", (event) => {
            if (
                event.target.matches(".sfm-field-item > input[type='checkbox']")
            ) {
                query.update();
            }
        });
    }

    _addAll() {
        this.addAllButton.addEventListener("click", () => {
            this.fieldElements.forEach((checkbox) => {
                checkbox.checked = true;
            });
            query.update();
        });
    }

    _clearAll() {
        this.clearAllButton.addEventListener("click", () => {
            this.fieldElements.forEach((checkbox) => {
                checkbox.checked = false;
            });
            query.update();
        });
    }

    _filterFields() {
        this.filterInput.addEventListener("input", (e) => {
            const filterValue = e.target.value.toLowerCase();
            const fieldItems = document.querySelectorAll(".sfm-field-item");
            fieldItems.forEach((item) => {
                const fieldName = item
                    .querySelector(".sfm-field-label-name")
                    .textContent.toLowerCase();
                const fieldApiName = item
                    .querySelector(".sfm-field-api-name")
                    .textContent.toLowerCase();
                const fieldType = item
                    .querySelector(".sfm-field-type")
                    .textContent.toLowerCase();

                const isMatching =
                    fieldName.includes(filterValue) ||
                    fieldApiName.includes(filterValue) ||
                    fieldType.includes(filterValue);

                if (isMatching) {
                    item.style.display = "block";
                } else {
                    item.style.display = "none";
                }
            });
        });
    }
}

class WhereClausePopulator {
    whereClauses = [];

    _selectedFieldApiName;
    _selectedFieldType;
    _selectedWhereOperation;

    constructor() {
        this._addEventListeners();
    }

    _addEventListeners() {
        this._selectField();
        this._selectWhereOperation();
        this._addWhereClause();
        this._clearWhereClause();
        this._clearAllWhereClauses();
    }

    _selectField() {
        const whereFieldSelector = document.querySelector(
            "#where-field-selector",
        );
        whereFieldSelector.addEventListener("change", (e) => {
            const whereValueSelect = document.querySelector(
                "#where-value-select",
            );
            while (whereValueSelect.firstChild) {
                whereValueSelect.firstChild.remove();
            }

            const selectedOption =
                e.currentTarget.options[e.currentTarget.selectedIndex];
            this._selectedFieldApiName = e.currentTarget.value;
            this._selectedFieldType = selectedOption.dataset.fieldType;

            if (
                this._selectedFieldType === "boolean" ||
                this._selectedFieldType === "picklist"
            ) {
                this._showWhereValueSelect();
            } else {
                this._showWhereValueInput();
            }
        });
    }

    _showWhereValueSelect() {
        if (this._selectedFieldType === "boolean") {
            this._showBooleanWhereValueSelect();
        } else if (this._selectedFieldType === "picklist") {
            this._requestPicklistFieldValues();
        }
    }

    _showBooleanWhereValueSelect() {
        const whereValueSelect = document.querySelector("#where-value-select");
        const whereValue = document.querySelector("#where-value");

        while (whereValueSelect.firstChild) {
            whereValueSelect.firstChild.remove();
        }
        const trueOption = document.createElement("option");
        trueOption.value = "true";
        trueOption.textContent = "TRUE";
        const falseOption = document.createElement("option");
        falseOption.value = "false";
        falseOption.textContent = "FALSE";
        whereValueSelect.appendChild(trueOption);
        whereValueSelect.appendChild(falseOption);
        whereValueSelect.style.display = "block";
        whereValue.style.display = "none";
    }

    _requestPicklistFieldValues() {
        vscode.postMessage({
            command: "getPicklistFieldValues",
            fieldApiName: this._selectedFieldApiName,
        });
    }

    _showWhereValueInput() {
        const whereValueSelect = document.querySelector("#where-value-select");
        const whereValue = document.querySelector("#where-value");

        whereValueSelect.style.display = "none";
        whereValue.style.display = "block";

        whereValue.value = "";
    }

    _addWhereClause() {
        const addWhereClauseButton =
            document.querySelector("#add-where-clause");

        addWhereClauseButton.addEventListener("click", () => {
            const whereValueSelect = document.querySelector(
                "#where-value-select",
            );
            const whereValue = document.querySelector("#where-value");
            const whereOperation = document.querySelector("#where-operation");
            const fieldSelector = document.querySelector(
                "#where-field-selector",
            );

            if (!this._selectedFieldApiName || !fieldSelector.value) {
                const fieldOptions = fieldSelector.querySelectorAll("option");
                this._selectedFieldApiName = fieldOptions[0].value;
            }

            const selectedWhereValue =
                whereValueSelect.style.display === "block"
                    ? whereValueSelect.value
                    : whereValue.value;

            const whereClause = {
                fieldApiName: this._selectedFieldApiName,
                operation: whereOperation.value,
                value: selectedWhereValue,
                fieldType: this._selectedFieldType,
            };

            const clauseExists = this.whereClauses.some(
                (existingClause) =>
                    existingClause.fieldApiName === whereClause.fieldApiName &&
                    existingClause.operation === whereClause.operation &&
                    existingClause.value === whereClause.value,
            );

            if (!clauseExists) {
                this.whereClauses.push(whereClause);
                query.update();
            }
        });
    }

    _clearWhereClause() {
        const clearWhereClauseButton = document.querySelector(
            "#clear-where-clause",
        );
        clearWhereClauseButton.addEventListener("click", () => {
            const whereFieldSelector = document.querySelector(
                "#where-field-selector",
            );
            const whereOperation = document.querySelector("#where-operation");
            const whereValue = document.querySelector("#where-value");
            const whereValueSelect = document.querySelector(
                "#where-value-select",
            );
            const actualWhereValue =
                whereValueSelect.style.display === "block"
                    ? whereValueSelect.value
                    : whereValue.value;

            this.whereClauses = this.whereClauses.filter(
                (clause) =>
                    clause.fieldApiName !== whereFieldSelector.value ||
                    clause.operation !== whereOperation.value ||
                    clause.value !== actualWhereValue,
            );

            query.update();
        });
    }

    _clearAllWhereClauses() {
        const clearAllWhereClausesButton = document.querySelector(
            "#clear-all-where-clauses",
        );
        clearAllWhereClausesButton.addEventListener("click", () => {
            this.whereClauses = [];
            query.update();
        });
    }

    showPicklistWhereValueSelect(picklistValues) {
        const whereValueSelect = document.querySelector("#where-value-select");
        const whereValue = document.querySelector("#where-value");

        for (const picklistValue of picklistValues) {
            if (!picklistValue.active) {
                continue;
            }

            const option = document.createElement("option");
            option.value = picklistValue.value;
            option.textContent = picklistValue.value;
            whereValueSelect.appendChild(option);
        }

        whereValueSelect.style.display = "block";
        whereValue.style.display = "none";
    }

    _selectWhereOperation() {
        const whereOperation = document.querySelector("#where-operation");
        whereOperation.addEventListener("change", (e) => {
            this._selectedWhereOperation = e.currentTarget.value;
        });
    }
}

class Query {
    constructor() {
        this._queryElement = document.querySelector("#query");
    }

    update() {
        const select = this._composeSelectFields();
        const from = this._composeFrom();
        const where = this._composeWhereClause();

        let queryValue = `${select}${from}${where}`;
        this._queryElement.value = queryValue;
    }

    _composeSelectFields() {
        const fieldCheckboxes = document.querySelectorAll(
            ".sfm-field-item > input[type='checkbox']",
        );

        const selectedFields = Array.from(fieldCheckboxes)
            .filter((checkbox) => checkbox.checked)
            .map((checkbox) => checkbox.dataset.fieldName);

        return `SELECT ${selectedFields.join(", ")}`;
    }

    _composeFrom() {
        const container = document.querySelector(".sfm-container");
        const objectName = container.dataset.objectName;
        return `\nFROM ${objectName}`;
    }

    _composeWhereClause() {
        const whereClauses = whereClausePopulator.whereClauses;
        if (whereClauses.length === 0) {
            return "";
        }

        const whereClause = whereClauses
            .map((clause) => {
                let formattedValue;

                if (
                    clause.fieldType === "string" ||
                    clause.fieldType === "picklist" ||
                    clause.fieldType === "multipicklist" ||
                    clause.fieldType === "textarea" ||
                    clause.fieldType === "phone" ||
                    clause.fieldType === "email" ||
                    clause.fieldType === "url" ||
                    clause.fieldType === "id"
                ) {
                    const escaped = clause.value.replace(/'/g, String.raw`\'`);
                    formattedValue = "'" + escaped + "'";
                } else if (clause.fieldType === "date") {
                    if (
                        !/^\d{4}-\d{2}-\d{2}$/.test(clause.value) &&
                        !/^[A-Z_]+(?::\d+)?$/.test(clause.value)
                    ) {
                        return null;
                    }
                    formattedValue = clause.value;
                } else if (clause.fieldType === "datetime") {
                    if (
                        !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/.test(
                            clause.value,
                        ) &&
                        !/^[A-Z_]+(?::\d+)?$/.test(clause.value)
                    ) {
                        return null;
                    }
                    formattedValue = clause.value;
                } else if (clause.fieldType === "boolean") {
                    formattedValue =
                        clause.value.toLowerCase() === "true"
                            ? "true"
                            : "false";
                } else if (
                    clause.fieldType === "int" ||
                    clause.fieldType === "double" ||
                    clause.fieldType === "currency" ||
                    clause.fieldType === "percent"
                ) {
                    if (!/^-?\d+(\.\d+)?$/.test(clause.value)) {
                        return null;
                    }
                    formattedValue = clause.value;
                } else {
                    formattedValue = `''`;
                }

                return `${clause.fieldApiName} ${clause.operation} ${formattedValue}`;
            })
            .filter((clause) => clause !== null)
            .join(" AND ");

        if (!whereClause) {
            return "";
        }

        return `\nWHERE ${whereClause}`;
    }
}

class FileSelector {
    _browseFileButton;
    _destinationFileInput;

    constructor() {
        this._browseFileButton = document.querySelector("#browse-file-button");
        this._destinationFileInput =
            document.querySelector("#destination-file");

        this._openFileDialog();
    }

    _openFileDialog() {
        this._browseFileButton.addEventListener("click", () => {
            vscode.postMessage({
                command: "openFileDialog",
                currentPath: this._destinationFileInput.value,
            });
        });
    }

    setDestinationFilePath(path) {
        this._destinationFileInput.value = path;
    }
}

class QueryCopier {
    _copyButton;
    _queryElement;

    constructor() {
        this._copyButton = document.querySelector("#copy-query-button");
        this._queryElement = document.querySelector("#query");
        this._addEventListeners();
    }

    _addEventListeners() {
        this._copyButton.addEventListener("click", () => {
            const queryValue = this._queryElement.value;
            if (!queryValue) {
                return;
            }

            navigator.clipboard.writeText(queryValue).then(() => {
                this._showCopiedFeedback();
            });
        });
    }

    _showCopiedFeedback() {
        const originalText = this._copyButton.textContent;
        this._copyButton.textContent = "Copied!";
        this._copyButton.classList.add("sfm-button-success");

        setTimeout(() => {
            this._copyButton.textContent = originalText;
            this._copyButton.classList.remove("sfm-button-success");
        }, 2000);
    }
}

class RecordsExporter {
    _exportButton;

    constructor() {
        this._exportButton = document.querySelector("#action-button");
        this._addEventListeners();
    }

    _addEventListeners() {
        this._exportButton.addEventListener("click", () => {
            // Clear any previous error messages
            ErrorMessage.hide();

            const queryValue = document.querySelector("#query").value;
            if (!queryValue) {
                ErrorMessage.show("Please provide a valid query.");
                return;
            }

            const destinationFile =
                document.querySelector("#destination-file").value;
            if (!destinationFile) {
                ErrorMessage.show("Please provide a destination file.");
                return;
            }

            this._disableButtons();

            vscode.postMessage({
                command: "exportRecords",
                query: queryValue,
                destinationFilePath: destinationFile,
            });
        });
    }

    _disableButtons = () => {
        const buttons = document.querySelectorAll(
            "button:not(#dml-proceed-button)",
        );
        buttons.forEach((button) => {
            button.setAttribute("disabled", "true");
            button.classList.add("disabled");
        });

        exportedFilePath = null;
        RecordsExporter._setDmlControlsEnabled(false);
    };

    enableButtons = () => {
        const buttons = document.querySelectorAll(
            "button:not(#dml-proceed-button)",
        );
        buttons.forEach((button) => {
            button.removeAttribute("disabled");
            button.classList.remove("disabled");
        });
    };

    static _setDmlControlsEnabled(enabled) {
        const dmlSelect = document.querySelector("#dml-operation-select");
        const dmlButton = document.querySelector("#dml-proceed-button");
        if (dmlSelect) {
            if (enabled) {
                dmlSelect.removeAttribute("disabled");
            } else {
                dmlSelect.setAttribute("disabled", "true");
            }
        }
        if (dmlButton) {
            if (enabled) {
                dmlButton.classList.remove("disabled");
            } else {
                dmlButton.classList.add("disabled");
            }
        }
    }
}

class ErrorMessage {
    static show(message) {
        const errorMessageElement = document.querySelector("#error-message");
        errorMessageElement.innerText = message;
        errorMessageElement.classList.add("visible");
        window.scrollTo({ behavior: "smooth" }, 1000);
    }

    static hide() {
        const errorMessageElement = document.querySelector("#error-message");
        errorMessageElement.classList.remove("visible");
        errorMessageElement.innerText = "";
    }
}

(() => {
    try {
        window.addEventListener("load", () => {
            whereClausePopulator = new WhereClausePopulator();
            query = new Query();
            fieldSelector = new FieldSelector();
            fileSelector = new FileSelector();
            recordsExporter = new RecordsExporter();
            queryCopier = new QueryCopier();

            const dmlProceedButton = document.querySelector(
                "#dml-proceed-button",
            );
            if (dmlProceedButton) {
                dmlProceedButton.addEventListener("click", () => {
                    if (!exportedFilePath) {
                        ErrorMessage.show(
                            "Please export records first before proceeding to DML.",
                        );
                        return;
                    }
                    const operationSelect = document.querySelector(
                        "#dml-operation-select",
                    );
                    if (operationSelect) {
                        vscode.postMessage({
                            command: "proceedToDml",
                            operation: operationSelect.value,
                            filePath: exportedFilePath,
                        });
                    }
                });
            }

            window.addEventListener("message", (event) => {
                const { command, value } = event.data;

                switch (command) {
                    case "populatePicklistFieldValues":
                        whereClausePopulator.showPicklistWhereValueSelect(
                            value,
                        );
                        break;
                    case "setDestinationFile":
                        fileSelector.setDestinationFilePath(value);
                        break;
                    case "exportComplete":
                        recordsExporter.enableButtons();
                        if (event.data.filePath) {
                            exportedFilePath = event.data.filePath;
                            RecordsExporter._setDmlControlsEnabled(true);
                        }
                        break;
                }
            });
        });
    } catch (error) {
        ErrorMessage.show(error.message);
    }
})();
