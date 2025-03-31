const vscode = acquireVsCodeApi();

(() => {
    window.addEventListener("load", () => {
        // Handle item selection
        const metadataListItems = document.querySelectorAll(
            ".metadata-list-item"
        );
        metadataListItems.forEach((item) => {
            item.addEventListener("click", () => {
                metadataListItems.forEach((i) => {
                    i.classList.remove("active");
                });
                item.classList.add("active");
            });
        });

        // Handle filtering
        const filterInput = document.getElementById("metadata-filter");
        if (filterInput) {
            filterInput.addEventListener("input", (e) => {
                const filterValue = e.target.value.toLowerCase().trim();
                
                metadataListItems.forEach((item) => {
                    const itemText = item.textContent.toLowerCase();
                    if (itemText.includes(filterValue)) {
                        item.style.display = "block";
                    } else {
                        item.style.display = "none";
                    }
                });
            });
        }
    });
})();
