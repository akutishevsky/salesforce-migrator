const vscode = acquireVsCodeApi();

let whereClausePopulator;
let query;
let fieldSelector;
let fileSelector;

class FieldSelector {
    fieldElements = [];
    addAllButton;
    clearAllButton;
    filterInput;
    fieldsContainer;

    constructor() {
        this.fieldElements = document.querySelectorAll(
            ".sfm-field-item > input[type='checkbox']"
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
            "#where-field-selector"
        );
        whereFieldSelector.addEventListener("change", (e) => {
            const whereValueSelect = document.querySelector(
                "#where-value-select"
            );
            whereValueSelect.innerHTML = "";

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

        whereValueSelect.innerHTML = `
            <option value="true">TRUE</option>
            <option value="false">FALSE</option>
        `;
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
                "#where-value-select"
            );
            const whereValue = document.querySelector("#where-value");
            const whereOperation = document.querySelector("#where-operation");
            const fieldSelector = document.querySelector(
                "#where-field-selector"
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
                    existingClause.value === whereClause.value
            );

            if (!clauseExists) {
                this.whereClauses.push(whereClause);
                query.update();
            }
        });
    }

    _clearWhereClause() {
        const clearWhereClauseButton = document.querySelector(
            "#clear-where-clause"
        );
        clearWhereClauseButton.addEventListener("click", () => {
            const whereFieldSelector = document.querySelector(
                "#where-field-selector"
            );
            const whereOperation = document.querySelector("#where-operation");
            const whereValue = document.querySelector("#where-value");
            const whereValueSelect = document.querySelector(
                "#where-value-select"
            );
            const actualWhereValue =
                whereValueSelect.style.display === "block"
                    ? whereValueSelect.value
                    : whereValue.value;

            this.whereClauses = this.whereClauses.filter(
                (clause) =>
                    clause.fieldApiName !== whereFieldSelector.value ||
                    clause.operation !== whereOperation.value ||
                    clause.value !== actualWhereValue
            );

            query.update();
        });
    }

    _clearAllWhereClauses() {
        const clearAllWhereClausesButton = document.querySelector(
            "#clear-all-where-clauses"
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
            ".sfm-field-item > input[type='checkbox']"
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
                let formattedValue = clause.value;

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
                    formattedValue = `'${clause.value.replace(/'/g, "\\'")}'`;
                } else if (
                    clause.fieldType === "date" ||
                    clause.fieldType === "datetime"
                ) {
                    formattedValue = `${clause.value}`;
                } else if (clause.fieldType === "boolean") {
                    formattedValue = clause.value.toLowerCase();
                } else {
                    formattedValue = `''`;
                }

                return `${clause.fieldApiName} ${clause.operation} ${formattedValue}`;
            })
            .join(" AND ");

        return `\nWHERE ${whereClause}`;
    }
}

class FileSelector {
    _browseFileButton;
    _destinationFileInput;

    constructor() {
        _browseFileButton = document.querySelector("#browse-file-button");
        _destinationFileInput = document.querySelector("#destination-file");
    }

    _openFileDialog() {
        _browseFileButton.addEventListener("click", () => {
            vscode.postMessage({
                command: "openFileDialog",
                currentPath: destinationFileInput.value,
            });
        });
    }
}

class ErrorMessage {
    static show(message) {
        const errorMessageElement = document.querySelector("#error-message");
        errorMessageElement.innerText = message;
        errorMessageElement.classList.add("visible");
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

            window.addEventListener("message", (event) => {
                const { command, value } = event.data;

                if (command === "populatePicklistFieldValues") {
                    whereClausePopulator.showPicklistWhereValueSelect(value);
                } else if (command === "setDestinationFile") {
                    // Update the file input with the selected path
                    const destinationFileInput =
                        document.getElementById("destination-file");
                    destinationFileInput.value = value;
                }
            });
        });
    } catch (error) {
        ErrorMessage.show(error.message);
    }
})();
