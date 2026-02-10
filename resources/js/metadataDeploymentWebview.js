const vscode = acquireVsCodeApi();

const initialize = () => {
    const actionBtns = document.querySelectorAll(".btn-action");
    actionBtns.forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const command = e.currentTarget.id;
            const metadataTypeName = e.currentTarget.value;

            vscode.postMessage({
                command: command,
                metadataTypeName: metadataTypeName,
            });
        });
    });

    const selectAllCheckbox = document.getElementById("select-all");
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener("change", () => {
            const checkboxes = document.querySelectorAll(".item-checkbox");
            checkboxes.forEach((cb) => {
                cb.checked = selectAllCheckbox.checked;
            });
            postSelectionChanged();
        });
    }

    const itemCheckboxes = document.querySelectorAll(".item-checkbox");
    itemCheckboxes.forEach((cb) => {
        cb.addEventListener("change", () => {
            syncSelectAllState();
            postSelectionChanged();
        });
    });
};

const syncSelectAllState = () => {
    const selectAllCheckbox = document.getElementById("select-all");
    if (!selectAllCheckbox) {
        return;
    }
    const checkboxes = document.querySelectorAll(".item-checkbox");
    const allChecked =
        checkboxes.length > 0 &&
        Array.from(checkboxes).every((cb) => cb.checked);
    selectAllCheckbox.checked = allChecked;
};

const postSelectionChanged = () => {
    const checkboxes = document.querySelectorAll(".item-checkbox:checked");
    const selectedItems = Array.from(checkboxes).map((cb) => cb.value);
    vscode.postMessage({
        command: "selectionChanged",
        selectedItems: selectedItems,
    });
};

window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.command === "updateSelections") {
        const selected = message.selectedItems || [];
        const checkboxes = document.querySelectorAll(".item-checkbox");
        checkboxes.forEach((cb) => {
            cb.checked = selected.includes(cb.value);
        });
        syncSelectAllState();
    }
});

window.addEventListener("load", initialize);
