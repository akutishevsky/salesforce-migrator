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

const toggleExpandableItem = (item) => {
    const metadataType = item.getAttribute("data-metadata-type");
    const childrenContainer = document.querySelector(
        `.folder-children[data-metadata-type="${metadataType}"]`
    );

    if (!childrenContainer) {
        return;
    }

    const isExpanded = item.classList.contains("expanded");

    if (isExpanded) {
        item.classList.remove("expanded");
        childrenContainer.classList.remove("visible");
    } else {
        item.classList.add("expanded");
        childrenContainer.classList.add("visible");

        if (!childrenContainer.hasAttribute("data-loaded")) {
            childrenContainer.innerHTML =
                '<div class="folder-child-loading">Loading folders...</div>';
            vscode.postMessage({
                command: "expandFolders",
                metadataType: metadataType,
            });
        }
    }
};

const setupMetadataItemListeners = () => {
    const regularItems = document.querySelectorAll(
        ".list-item:not(.list-item-expandable)"
    );
    regularItems.forEach((item) => {
        item.addEventListener("click", () => {
            selectMetadataItem(item, regularItems);
        });
    });

    const expandableItems = document.querySelectorAll(".list-item-expandable");
    expandableItems.forEach((item) => {
        item.addEventListener("click", () => {
            toggleExpandableItem(item);
        });
    });
};

const handleFoldersLoaded = (message) => {
    const container = document.querySelector(
        `.folder-children[data-metadata-type="${message.metadataType}"]`
    );

    if (!container) {
        return;
    }

    container.setAttribute("data-loaded", "true");

    if (message.error || !message.folders || message.folders.length === 0) {
        container.innerHTML =
            '<div class="folder-child-loading">No folders found</div>';
        return;
    }

    let html = "";
    for (const folder of message.folders) {
        html += `<div class="folder-child-item" data-metadata-type="${message.metadataType}">${folder}</div>`;
    }
    container.innerHTML = html;

    container.querySelectorAll(".folder-child-item").forEach((item) => {
        item.addEventListener("click", () => {
            vscode.postMessage({
                command: "folderSelected",
                metadataType: item.getAttribute("data-metadata-type"),
                folder: item.textContent.trim(),
            });
        });
    });
};

window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.command === "foldersLoaded") {
        handleFoldersLoaded(message);
    }
});

window.addEventListener("load", () => {
    setupMetadataItemListeners();
});
