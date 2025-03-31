const vscode = acquireVsCodeApi();

function selectSalesforceOrg(event) {
    const selectedOrgAlias = event.target.value;
    const selectorType = event.target.closest('[data-selector-type]').dataset.selectorType;

    vscode.postMessage({
        command: "orgSelected",
        orgAlias: selectedOrgAlias,
        selectorType: selectorType
    });
}

(() => {
    window.addEventListener("load", (event) => {
        const radios = document.querySelectorAll("input[type='radio']");
        radios.forEach((radio) => {
            radio.addEventListener("change", (event) => {
                selectSalesforceOrg(event);
            });
        });
    });
})();
