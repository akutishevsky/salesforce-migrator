const vscode = acquireVsCodeApi();

let dmlOperation;

/**
 * Renders a mapping table with CSV headers and Salesforce field selects
 * using DOM APIs to prevent XSS from untrusted CSV headers and field names.
 * @param {HTMLElement} container - The container element to render the table into
 * @param {string[]} csvHeaders - Array of CSV header names
 * @param {Array<{name: string, label: string}>} fields - Array of Salesforce fields with name and label
 */
function renderMappingTable(container, csvHeaders, fields) {
    container.textContent = "";

    if (!csvHeaders || !csvHeaders.length || !fields || !fields.length) {
        const hint = document.createElement("p");
        hint.className = "sfm-hint";
        hint.textContent = "No CSV headers or fields found to map.";
        container.appendChild(hint);
        return;
    }

    const table = document.createElement("table");
    table.className = "sfm-mapping-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const thHeader = document.createElement("th");
    thHeader.className = "sfm-mapping-header";
    thHeader.textContent = "CSV Header";
    const thField = document.createElement("th");
    thField.className = "sfm-mapping-header";
    thField.textContent = "Salesforce Field Name";
    headRow.appendChild(thHeader);
    headRow.appendChild(thField);
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    csvHeaders.forEach((header) => {
        if (!header) {
            return;
        }

        const row = document.createElement("tr");

        const tdHeader = document.createElement("td");
        tdHeader.className = "sfm-mapping-cell";
        tdHeader.textContent = header;

        const tdField = document.createElement("td");
        tdField.className = "sfm-mapping-cell";

        const select = document.createElement("select");
        select.className = "sfm-select sfm-field-mapping";
        select.dataset.csvHeader = header;

        const noneOption = document.createElement("option");
        noneOption.value = "";
        noneOption.textContent = "-- None --";
        select.appendChild(noneOption);

        fields.forEach((field) => {
            const option = document.createElement("option");
            option.value = field.name;
            option.textContent = `${field.label} (${field.name})`;
            if (field.name === header) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        tdField.appendChild(select);
        row.appendChild(tdHeader);
        row.appendChild(tdField);
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

(() => {
    window.addEventListener("load", () => {
        const sfmContainer = document.querySelector(".sfm-container");
        dmlOperation = sfmContainer.dataset.dmlOperation;

        const browseFileButton = document.querySelector("#browse-file-button");
        browseFileButton.addEventListener("click", async () => {
            vscode.postMessage({
                command: "selectSourceFile",
            });
        });
        const actionButton = document.querySelector("#action-button");
        if (actionButton) {
            actionButton.addEventListener("click", () => {
                const sourceFile = document.querySelector("#source-file").value;
                const errorMessage = document.querySelector("#error-message");

                // Validate that a CSV file has been selected
                if (!sourceFile) {
                    errorMessage.textContent =
                        "Please select a CSV file before proceeding.";
                    return;
                }

                errorMessage.textContent = ""; // Clear any previous error

                const mapping = [];
                const fieldSelects =
                    document.querySelectorAll(".sfm-field-mapping");

                fieldSelects.forEach((select) => {
                    const csvHeader = select.dataset.csvHeader;
                    const salesforceField = select.value;

                    if (salesforceField) {
                        // Push as a tuple array [header, field] to match TypeScript interface
                        mapping.push([csvHeader, salesforceField]);
                    }
                });

                const matchingField = document.querySelector("#matching-field");

                vscode.postMessage({
                    command: "performDmlAction",
                    mapping: mapping,
                    matchingField: matchingField ? matchingField.value : "",
                    // lineEnding is now detected automatically from the file
                });
            });
        }
    });

    window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.command) {
            case "setSourceFile":
                document.querySelector("#source-file").value = message.filePath;

                if (dmlOperation === "Delete") {
                    return;
                }

                const sfmMapping = document.querySelector("#sfm-mapping");
                sfmMapping.classList.remove("sfm-hidden");

                const mappingContainer = document.querySelector(
                    ".sfm-mapping-container",
                );

                renderMappingTable(
                    mappingContainer,
                    message.csvHeaders,
                    message.fields,
                );

                break;
            default:
                break;
        }
    });
})();
