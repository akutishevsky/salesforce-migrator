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
        const cleanHeader = header.trim();
        if (!cleanHeader) {
            return;
        }

        html += `
            <tr>
                <td class="sfm-mapping-cell">${cleanHeader}</td>
                <td class="sfm-mapping-cell">
                    <select class="sfm-select sfm-field-mapping" data-csv-header="${cleanHeader}">
                        <option value="">-- None --</option>
        `;

        fields.forEach((field) => {
            const selected = field.name === cleanHeader ? "selected" : "";
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
