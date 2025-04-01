const filterMetadataItems = (filterValue, listItems) => {
    listItems.forEach((item) => {
        const itemText = item.textContent.toLowerCase();
        if (itemText.includes(filterValue)) {
            item.style.display = "block";
        } else {
            item.style.display = "none";
        }
    });
};

const setupFilterListener = (filterInput, listItems) => {
    if (filterInput) {
        filterInput.addEventListener("input", (e) => {
            const filterValue = e.target.value.toLowerCase().trim();
            filterMetadataItems(filterValue, listItems);
        });
    }
};

window.addEventListener("load", () => {
    const listItems = document.querySelectorAll(".list-item");
    const filterInput = document.getElementById("filter");

    setupFilterListener(filterInput, listItems);
});
