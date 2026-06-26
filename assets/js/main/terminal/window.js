const terminalClose = document.querySelector('[name="drag-close"][data-name="terminal"]');
const terminalWin = document.querySelector('[name="drag-move"][data-name="terminal"]');
const terminalBtn = document.getElementById("mint-terminal-btn");

terminalClose.addEventListener("click", () => {
    terminalWin.classList.remove("show");
    terminalBtn.classList.remove("enabled");
});

terminalBtn.addEventListener("click", () => {
    if (terminalWin.classList.contains("show")) {
        terminalWin.classList.remove("show");
        terminalBtn.classList.remove("enabled");
    } else {
        terminalWin.classList.add("show");
        terminalBtn.classList.add("enabled");
        loadChatMessages();
    }
});

const chatClose = document.querySelector('[name="drag-close"][data-name="chat"]');
const chatWindow = document.querySelector('[name="drag-move"][data-name="chat"]');
const chatBtn = document.getElementById("mint-chat-btn");

chatClose.addEventListener("click", () => {
    chatWindow.classList.remove("show");
    chatBtn.classList.remove("enabled");
});

chatBtn.addEventListener("click", () => {
    if (chatWindow.classList.contains("show")) {
        chatWindow.classList.remove("show");
        chatBtn.classList.remove("enabled");
    } else {
        chatWindow.classList.add("show");
        chatBtn.classList.add("enabled");
        loadChatMessages();
    }
});