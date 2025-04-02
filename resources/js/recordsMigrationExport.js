const vscode = acquireVsCodeApi();

let whereClausePopulator;
let query;

const updateQuery = () => {
    const fieldsContainer = document.querySelector(".sfm-fields-container");
    fieldsContainer.addEventListener("change", (event) => {
        if (event.target.matches(".sfm-field-item > input[type='checkbox']")) {
            query.update();
        }
    });
};

const filterFields = () => {
    const filterInput = document.querySelector(".sfm-filter > input");
    filterInput.addEventListener("input", (e) => {
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
};

const setupFieldSelectionButtons = () => {
    const addAllButton = document.getElementById("add-all-fields");
    const clearAllButton = document.getElementById("clear-all-fields");
    const fieldCheckboxes = document.querySelectorAll(
        ".sfm-field-item > input[type='checkbox']"
    );

    addAllButton.addEventListener("click", () => {
        fieldCheckboxes.forEach((checkbox) => {
            checkbox.checked = true;
        });
        // Directly call query.update() after changing checkboxes
        query.update();
    });

    clearAllButton.addEventListener("click", () => {
        fieldCheckboxes.forEach((checkbox) => {
            checkbox.checked = false;
        });
        // Directly call query.update() after changing checkboxes
        query.update();
    });
};

class WhereClausePopulator {
    whereClauses = [];

    _selectedFieldApiName;
    _selectedFieldType;
    _selectedWhereOperation;

    constructor() {
        this._addEventListeners();
    }

    _addEventListeners() {
        try {
            this._selectField();
            this._selectWhereOperation();
            this._addWhereClause();
            this._clearWhereClause();
            this._clearAllWhereClauses();
        } catch (error) {
            console.error("Error in WhereClausePopulator: ", error);
        }
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

        // Remove existing event listener if any
        addWhereClauseButton.removeEventListener(
            "click",
            this._handleAddWhereClause
        );

        // Create the bound event handler and store it as a property
        this._handleAddWhereClause = () => {
            const whereValueSelect = document.querySelector(
                "#where-value-select"
            );
            const whereValue = document.querySelector("#where-value");
            const whereOperation = document.querySelector("#where-operation");
            const fieldSelector = document.querySelector(
                "#where-field-selector"
            );

            // Validate inputs
            if (!this._selectedFieldApiName || !fieldSelector.value) {
                alert("Please select a field first");
                return;
            }

            const selectedWhereValue =
                whereValueSelect.style.display === "block"
                    ? whereValueSelect.value
                    : whereValue.value;

            // Validate that a value is provided
            if (!selectedWhereValue.trim()) {
                alert("Please enter a filter value");
                return;
            }

            const whereClause = {
                fieldApiName: this._selectedFieldApiName,
                operation: whereOperation.value,
                value: selectedWhereValue,
                fieldType: this._selectedFieldType,
            };

            this.whereClauses.push(whereClause);

            query.update();
        };

        // Add the event listener
        addWhereClauseButton.addEventListener(
            "click",
            this._handleAddWhereClause
        );
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
                }

                return `${clause.fieldApiName} ${clause.operation} ${formattedValue}`;
            })
            .join(" AND ");

        return `\nWHERE ${whereClause}`;
    }
}

const initPage = () => {
    // Initialize objects first
    whereClausePopulator = new WhereClausePopulator();
    query = new Query();
    
    // Then set up event handlers
    updateQuery();
    filterFields();
    setupFieldSelectionButtons();

    window.addEventListener("message", (event) => {
        const { command, value } = event.data;

        if (command === "populatePicklistFieldValues") {
            whereClausePopulator.showPicklistWhereValueSelect(value);
        }
    });
};

try {
    window.addEventListener("load", initPage);
} catch (error) {
    console.error(error);
}
