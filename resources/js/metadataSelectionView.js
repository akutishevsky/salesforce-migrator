const vscode = acquireVsCodeApi();

const initialize = () => {
    const batchRetrieveBtn = document.getElementById("batch-retrieve");
    if (batchRetrieveBtn) {
        batchRetrieveBtn.addEventListener("click", () => {
            vscode.postMessage({ command: "batchRetrieve" });
        });
    }

    const batchDeployBtn = document.getElementById("batch-deploy");
    if (batchDeployBtn) {
        batchDeployBtn.addEventListener("click", () => {
            vscode.postMessage({ command: "batchDeploy" });
        });
    }

    const clearSelectionsBtn = document.getElementById("clear-selections");
    if (clearSelectionsBtn) {
        clearSelectionsBtn.addEventListener("click", () => {
            vscode.postMessage({ command: "clearSelections" });
        });
    }

    const removeButtons = document.querySelectorAll(".remove-item");
    removeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            vscode.postMessage({
                command: "removeItem",
                key: btn.dataset.key,
                item: btn.dataset.item,
            });
        });
    });
};

window.addEventListener("load", initialize);
