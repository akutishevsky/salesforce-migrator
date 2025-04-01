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

const setupMetadataItemListeners = () => {
    const metadataListItems = document.querySelectorAll(".list-item");
    metadataListItems.forEach((item) => {
        item.addEventListener("click", () => {
            selectMetadataItem(item, metadataListItems);
        });
    });
};

window.addEventListener("load", () => {
    setupMetadataItemListeners();
});
