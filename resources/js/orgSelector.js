const vscode = acquireVsCodeApi();

function selectSalesforceOrg(event, radios) {
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
}

(() => {
    window.addEventListener("load", (event) => {
        const radios = document.querySelectorAll("input[type='radio']");
        radios.forEach((radio) => {
            radio.addEventListener("change", (event) => {
                selectSalesforceOrg(event, radios);
            });
        });
    });
})();
