const vscode = acquireVsCodeApi();

let dmlOperation;

(() => {
    window.addEventListener("load", () => {
        const sfmContainer = document.querySelector(".sfm-container");
        dmlOperation = sfmContainer.dataset.dmlOperation;

        const browseFileButton = document.querySelector("#browse-file-button");
        browseFileButton.addEventListener("click", async () => {
            vscode.postMessage({
                command: "selectSourceFile",
            });
        });
    });

    window.addEventListener("message", (event) => {
        const message = event.data;
        switch (message.command) {
            case "setSourceFile":
                document.querySelector("#source-file").value = message.value;

                if (dmlOperation !== "Delete") {
                    const sfmMapping = document.querySelector("#sfm-mapping");
                    sfmMapping.classList.remove("sfm-hidden");
                }

                break;
            default:
                break;
        }
    });
})();
