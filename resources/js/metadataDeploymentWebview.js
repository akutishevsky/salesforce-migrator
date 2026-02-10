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

    const searchInput = document.getElementById("search");
    const clearBtn = document.getElementById("search-clear");

    const filterRows = (query) => {
        const rows = document.querySelectorAll("tbody tr");
        rows.forEach((row) => {
            const cells = row.querySelectorAll("td[data-label]");
            const matches = Array.from(cells).some((cell) =>
                cell.textContent.toLowerCase().includes(query),
            );
            row.style.display = matches ? "" : "none";
        });
    };

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterRows(query);
            clearBtn.classList.toggle("visible", e.target.value.length > 0);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            searchInput.value = "";
            filterRows("");
            clearBtn.classList.remove("visible");
            searchInput.focus();
        });
    }

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
