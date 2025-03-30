const vscode = acquireVsCodeApi();

(() => {
    window.addEventListener("load", (event) => {
        const radios = document.querySelectorAll("input[type='radio']");
        radios.forEach((radio) => {
            radio.addEventListener("change", (event) => {
                const selectedOrgAlias = event.target.value;

                radios.forEach((r) => {
                    if (r !== event.target) {
                        r.checked = false;
                    }
                });

                vscode.postMessage({
                    action: "orgSelected",
                    orgAlias: selectedOrgAlias,
                });
            });
        });
    });
})();
