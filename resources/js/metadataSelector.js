const vscode = acquireVsCodeApi();

const selectMetadataItem = (item, metadataListItems) => {
    metadataListItems.forEach((i) => {
        i.classList.remove("active");
    });
    item.classList.add("active");

    vscode.postMessage({
        command: "metadataSelected",
        metadata: item.textContent.trim(),
    });
};

const setupMetadataItemListeners = (metadataListItems) => {
    metadataListItems.forEach((item) => {
        item.addEventListener("click", () => {
            selectMetadataItem(item, metadataListItems);
        });
    });
};

const filterMetadataItems = (filterValue, metadataListItems) => {
    metadataListItems.forEach((item) => {
        const itemText = item.textContent.toLowerCase();
        if (itemText.includes(filterValue)) {
            item.style.display = "block";
        } else {
            item.style.display = "none";
        }
    });
};

const setupFilterListener = (filterInput, metadataListItems) => {
    if (filterInput) {
        filterInput.addEventListener("input", (e) => {
            const filterValue = e.target.value.toLowerCase().trim();
            filterMetadataItems(filterValue, metadataListItems);
        });
    }
};

const initialize = () => {
    const metadataListItems = document.querySelectorAll(".metadata-list-item");
    const filterInput = document.getElementById("metadata-filter");

    setupMetadataItemListeners(metadataListItems);
    setupFilterListener(filterInput, metadataListItems);
};

window.addEventListener("load", initialize);
