const terminalClose = document.querySelector('[name="drag-close"][data-name="terminal"]');
const terminalWin = document.querySelector('[name="drag-move"][data-name="terminal"]');
const terminalBtn = document.getElementById("mint-terminal-btn");

terminalClose.addEventListener("click", () => {
    terminalWin.classList.remove("show");
    terminalBtn.classList.remove("enabled");
});

terminalBtn.addEventListener("click", () => {
    terminalWin.classList.add("show");
    terminalBtn.classList.add("enabled");
    loadChatMessages();
});