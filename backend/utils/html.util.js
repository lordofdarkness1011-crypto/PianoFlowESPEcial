function escapeHtml(value) {
    const characters = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return String(value ?? "").replace(
        /[&<>"']/g,
        (character) => characters[character]
    );
}

function textToHtml(value) {
    return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

module.exports = {
    escapeHtml,
    textToHtml
};