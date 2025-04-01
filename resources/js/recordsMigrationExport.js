const vscode = acquireVsCodeApi();

const updateQuery = () => {
    const objectName = document.querySelector(".sfm-container").dataset.objectName;
    const query = document.querySelector("#query");
    const fieldCheckboxes = document.querySelectorAll(
        ".sfm-field-item > input[type='checkbox']"
    );

    const selectedFields = [];
    for (const checkbox of fieldCheckboxes) {
        if (checkbox.checked) {
            selectedFields.push(checkbox.dataset.fieldName);
        }
    }

    const queryValue = `SELECT ${selectedFields.join(
        ", "
    )}\nFROM ${objectName}`;

    query.value = queryValue;
};

(() => {
    window.addEventListener("load", (event) => {
        const fieldCheckboxes = document.querySelectorAll(
            ".sfm-field-item > input[type='checkbox']"
        );

        for (const checkbox of fieldCheckboxes) {
            checkbox.addEventListener("change", (event) => {
                updateQuery();
            });
        }
    });
})();
