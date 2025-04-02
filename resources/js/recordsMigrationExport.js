const vscode = acquireVsCodeApi();

let whereClausePopulator;

const updateQuery = () => {
    let fieldCheckboxes = document.querySelectorAll(
        ".sfm-field-item > input[type='checkbox']"
    );
    const container = document.querySelector(".sfm-container");
    const objectName = container.dataset.objectName;
    const queryTextarea = document.querySelector("#query");

    fieldCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
            fieldCheckboxes = document.querySelectorAll(
                ".sfm-field-item > input[type='checkbox']"
            );

            const selectedFields = Array.from(fieldCheckboxes)
                .filter((checkbox) => checkbox.checked)
                .map((checkbox) => checkbox.dataset.fieldName);

            queryTextarea.value = `SELECT ${selectedFields.join(
                ", "
            )}\nFROM ${objectName}`;
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

const initPage = () => {
    updateQuery();
    filterFields();
    setupFieldSelectionButtons();
    whereClausePopulator = new WhereClausePopulator();

    window.addEventListener("message", (event) => {
        const { command, value } = event.data;

        if (command === "populatePicklistFieldValues") {
            whereClausePopulator.showPicklistWhereValueSelect(value);
        }
    });
};

window.addEventListener("load", initPage);
