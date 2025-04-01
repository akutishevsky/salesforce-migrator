const vscode = acquireVsCodeApi();

const updateQuery = () => {
    const container = document.querySelector(".sfm-container");
    const objectName = container.dataset.objectName;
    const queryTextarea = document.querySelector("#query");
    const fieldCheckboxes = document.querySelectorAll(
        ".sfm-field-item > input[type='checkbox']"
    );

    const selectedFields = Array.from(fieldCheckboxes)
        .filter((checkbox) => checkbox.checked)
        .map((checkbox) => checkbox.dataset.fieldName);

    queryTextarea.value = `SELECT ${selectedFields.join(
        ", "
    )}\nFROM ${objectName}`;
};

const initPage = () => {
    const fieldCheckboxes = document.querySelectorAll(
        ".sfm-field-item > input[type='checkbox']"
    );

    fieldCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", updateQuery);
    });
};

window.addEventListener("load", initPage);
