const vscode = acquireVsCodeApi();

let dmlOperation;

/**
 * Renders a mapping table with CSV headers and Salesforce field selects
 * @param {string[]} csvHeaders - Array of CSV header names
 * @param {Array<{name: string, label: string}>} fields - Array of Salesforce fields with name and label
 * @returns {string} HTML for the mapping table
 */
function renderMappingTable(csvHeaders, fields) {
    if (!csvHeaders || !csvHeaders.length || !fields || !fields.length) {
        return '<p class="sfm-hint">No CSV headers or fields found to map.</p>';
    }

    let html = `
        <table class="sfm-mapping-table">
            <thead>
                <tr>
                    <th class="sfm-mapping-header">CSV Header</th>
                    <th class="sfm-mapping-header">Salesforce Field Name</th>
                </tr>
            </thead>
            <tbody>
    `;

    csvHeaders.forEach((header) => {
        // Headers are already properly parsed by the server-side code
        // Just check if we have an empty header
        if (!header) {
            return;
        }

        html += `
            <tr>
                <td class="sfm-mapping-cell">${header}</td>
                <td class="sfm-mapping-cell">
                    <select class="sfm-select sfm-field-mapping" data-csv-header="${header}">
                        <option value="">-- None --</option>
        `;

        fields.forEach((field) => {
            const selected = field.name === header ? "selected" : "";
            html += `
                <option value="${field.name}" ${selected}>
                    ${field.label} (${field.name})
                </option>
            `;
        });

        html += `
                    </select>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    return html;
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
                    errorMessage.textContent = "Please select a CSV file before proceeding.";
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
                    matchingField: matchingField ? matchingField.value : ""
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
                    ".sfm-mapping-container"
                );

                mappingContainer.innerHTML = renderMappingTable(
                    message.csvHeaders,
                    message.fields
                );

                break;
            default:
                break;
        }
    });
})();
