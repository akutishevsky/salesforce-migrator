const vscode = acquireVsCodeApi();

let whereClausePopulator;
let query;

const updateQuery = () => {
    let fieldCheckboxes = document.querySelectorAll(
        ".sfm-field-item > input[type='checkbox']"
    );
    const container = document.querySelector(".sfm-container");
    const objectName = container.dataset.objectName;
    const queryTextarea = document.querySelector("#query");

    fieldCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            query.update();
        });
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
        if (fieldCheckboxes.length > 0) {
            fieldCheckboxes[0].dispatchEvent(new Event("change"));
        }
    });

    clearAllButton.addEventListener("click", () => {
        fieldCheckboxes.forEach((checkbox) => {
            checkbox.checked = false;
        });
        if (fieldCheckboxes.length > 0) {
            fieldCheckboxes[0].dispatchEvent(new Event("change"));
        }
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
            this._selectWhereOperarion();
            this._addWhereClause();
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
        addWhereClauseButton.addEventListener("click", () => {
            const whereValueSelect = document.querySelector(
                "#where-value-select"
            );
            const whereValue = document.querySelector("#where-value");
            const whereOperation = document.querySelector("#where-operation");
            const selectedWhereValue =
                whereValueSelect.style.display === "block"
                    ? whereValueSelect.value
                    : whereValue.value;

            const whereClause = {
                fieldApiName: this._selectedFieldApiName,
                operation: whereOperation.value,
                value: selectedWhereValue,
            };

            this.whereClauses.push(whereClause);

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

    _selectWhereOperarion() {
        const whereOperation = document.querySelector("#where-operation");
        whereOperation.addEventListener("change", (e) => {
            this._selectedWhereOperation = e.currentTarget.value;
        });
    }
}

class Query {
    _queryElement;

    constructor() {
        this._queryElement = document.querySelector("#query");
    }

    update() {
        const select = this._composeSelectFields();
        const from = this._composeFrom();
        const where = this._composeWhereClause();

        const queryTextarea = document.querySelector("#query");
        let queryValue = `${select}${from}${where}`;
        queryTextarea.value = queryValue;
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
                return `${clause.fieldApiName} ${clause.operation} ${clause.value}`;
            })
            .join(" AND ");

        return `\nWHERE ${whereClause}`;
    }
}

const initPage = () => {
    updateQuery();
    filterFields();
    setupFieldSelectionButtons();

    whereClausePopulator = new WhereClausePopulator();
    query = new Query();

    window.addEventListener("message", (event) => {
        const { command, value } = event.data;

        if (command === "populatePicklistFieldValues") {
            whereClausePopulator.showPicklistWhereValueSelect(value);
        }
    });
};

window.addEventListener("load", initPage);
