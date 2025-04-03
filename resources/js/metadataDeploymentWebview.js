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
};

window.addEventListener("load", initialize);
