// chat feature
// on chat open, connect to WS and get all chat
// then get chat every 1 minute to synchronize



window.log = log; // available for all

function getPrjId() {
    if (!["scratch.mit.edu", "turbowarp.org", "mirror.turbowarp.xyz"].includes(window.location.hostname)) {
        log("Invalid host, returning default project ID", "error")
        return "489159823";
    }
    let prjId = "489159823"
    if (window.location.hostname === "scratch.mit.edu") {
        prjId = parseInt(window.location.pathname.split("/")[2].replace(/\D/g, "").trim(),);
    } else {
        prjId = window.location.pathname.split("/")[1].replace(/\D/g, "").trim();
    }

    return prjId
}
async function getScratchUsername() {
  const res = await fetch("/session/", {
    credentials: "include",
    headers: {
      "X-Requested-With": "XMLHttpRequest"
    }
  });

  if (!res.ok) {
    throw new Error(`Scratch session request failed: ${res.status}`);
  }

  const data = await res.json();
  return data?.user?.username ?? null;
}
async function getUsername() {
    try { if (window.location.hostname === "scratch.mit.edu") return await getScratchUsername(); else return window.vm.runtime.ioDevices.userData._username; } catch (e) { console.error("Failed to get username", e)}
}
async function addChatMessage(content, username, time) {
    const chatContent = document.getElementById("chat-content");
    if (!chatContent) return;

    const date = time instanceof Date ? time : new Date(time);
    const isValidDate = !Number.isNaN(date.getTime());

    function isSameDay(a, b) {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    function formatMessageTime(d) {
        if (!isValidDate) return String(time);

        const now = new Date();

        const timePart = d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });

        if (isSameDay(d, now)) {
            return timePart;
        }

        const sameYear = d.getFullYear() === now.getFullYear();

        if (sameYear) {
            return d.toLocaleString([], {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit"
            });
        }

        return d.toLocaleString([], {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    const formattedTime = formatMessageTime(date);

    const selfUsername = await getUsername();
    log(`Self username: ${selfUsername}`, "info");
    const isSelf = !!selfUsername && username === selfUsername;

    const bubble = document.createElement("span");
    bubble.className = `chat-bubble glass${isSelf ? " self" : ""}`;
    bubble.textContent = content;

    const latestUser = chatContent.querySelector(":scope > .chat-user");
    const latestTime = chatContent.querySelector(":scope > .chat-time");

    if (latestUser && latestUser.textContent === username) {
        if (latestTime) {
            latestTime.dataset.time = String(time);
            latestTime.textContent = formattedTime;
        }

        chatContent.append(bubble);
        return;
    }

    const userEl = document.createElement("span");
    userEl.className = `chat-user${isSelf ? " self" : ""}`;
    userEl.textContent = username;

    const timeEl = document.createElement("span");
    timeEl.className = "chat-time";
    timeEl.dataset.time = String(time);
    timeEl.textContent = formattedTime;

    const frag = document.createDocumentFragment();
    frag.appendChild(bubble);
    frag.appendChild(userEl);
    frag.appendChild(timeEl);

    chatContent.append(frag);
}

async function getChatMessages() {
    try {
        const prj = encodeURIComponent(getPrjId());

        const res = await fetch(
            `https://mint-cloud.alwaysdata.net/backend/get-chat?project=${prj}`,
            {
                method: "GET",
            }
        )

        if (!res.ok) {
            log(`Failed to fetch chat data: error ${res.status}, content ${res.statusText}`, "error");
        }

        const resData = await res.json();
        const data = resData.data.slice(0, 150)

        return data;
    } catch (e) {
        log(`Error while getting chat ${e}`)
    }
}

let isLoadingChatMessages = false;

async function loadChatMessages() {
    if (isLoadingChatMessages) return;
    isLoadingChatMessages = true;

    try {
        const chatBtn = document.getElementById("mint-chat-btn");
        if (!chatBtn || !chatBtn.classList.contains("enabled")) {
            return;
        }

        const chatContainer = document.getElementById("chat-content");
        if (!chatContainer) return;

        chatContainer.innerHTML = "";

        const messages = await getChatMessages();

        if (!Array.isArray(messages) || messages.length < 1) {
            chatContainer.innerHTML = '<i class="time">Chat is empty...</i>';
            return;
        }

        for (const message of messages) {
            await addChatMessage(message.text, message.username, message.created_at);
        }
    } finally {
        isLoadingChatMessages = false;
    }
}

const chatClose = document.querySelector('[name="drag-close"][data-name="chat"]');
const chatWindow = document.querySelector('[name="drag-move"][data-name="chat"]');
const chatBtn = document.getElementById("mint-chat-btn");

chatClose.addEventListener("click", () => {
    chatWindow.classList.remove("show");
    chatBtn.classList.remove("enabled");
});

chatBtn.addEventListener("click", () => {
    chatWindow.classList.add("show");
    chatBtn.classList.add("enabled");
    loadChatMessages();
});

const loadChatInterval = setInterval(loadChatMessages, 45000);


// <span class="chat-bubble glass">${content}</span>
// <span class="chat-time" data-time="${time}">${formattedTime}</span>
// <span class="chat-user">${username}</span>


/*
      "username": "user",
      "text": "content",
      "created_at": "2026-04-18T16:04:37",
      "prj_id": 489159823
*/