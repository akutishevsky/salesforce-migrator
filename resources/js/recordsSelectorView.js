const vscode = acquireVsCodeApi();

const selectCustomObject = (item, customObjects) => {
    customObjects.forEach((i) => {
        i.classList.remove("active");
    });
    item.classList.add("active");

    vscode.postMessage({
        command: "customObjectSelected",
        customObject: item.textContent.trim(),
    });
};

const setupObjectListeners = () => {
    const customObjects = document.querySelectorAll(".list-item");
    customObjects.forEach((item) => {
        item.addEventListener("click", () => {
            selectCustomObject(item, customObjects);
        });
    });
};

window.addEventListener("load", () => {
    setupObjectListeners();
});
