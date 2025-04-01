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

const initPage = () => {
    const fieldCheckboxes = document.querySelectorAll(
        ".sfm-field-item > input[type='checkbox']"
    );
    fieldCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", updateQuery);
    });
    filterFields();
};

window.addEventListener("load", initPage);
