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

const findFolderChildrenContainer = (metadataType) => {
    const containers = document.querySelectorAll(".folder-children");
    for (const container of containers) {
        if (container.dataset.metadataType === metadataType) {
            return container;
        }
    }
    return null;
};

const toggleExpandableItem = (item) => {
    const metadataType = item.dataset.metadataType;
    const childrenContainer = findFolderChildrenContainer(metadataType);

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
            const loading = document.createElement("div");
            loading.className = "folder-child-loading";
            loading.textContent = "Loading folders...";
            childrenContainer.textContent = "";
            childrenContainer.appendChild(loading);
            vscode.postMessage({
                command: "expandFolders",
                metadataType: metadataType,
            });
        }
    }
};

const setupMetadataItemListeners = () => {
    const regularItems = document.querySelectorAll(
        ".list-item:not(.list-item-expandable)",
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
    const container = findFolderChildrenContainer(message.metadataType);

    if (!container) {
        return;
    }

    container.setAttribute("data-loaded", "true");
    container.textContent = "";

    if (message.error || !message.folders || message.folders.length === 0) {
        const noFolders = document.createElement("div");
        noFolders.className = "folder-child-loading";
        noFolders.textContent = "No folders found";
        container.appendChild(noFolders);
        return;
    }

    for (const folder of message.folders) {
        const folderItem = document.createElement("div");
        folderItem.className = "folder-child-item";
        folderItem.dataset.metadataType = message.metadataType;
        folderItem.textContent = folder;

        folderItem.addEventListener("click", () => {
            vscode.postMessage({
                command: "folderSelected",
                metadataType: folderItem.dataset.metadataType,
                folder: folderItem.textContent.trim(),
            });
        });

        container.appendChild(folderItem);
    }
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
