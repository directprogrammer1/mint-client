// inject all link rel

function log(content, type = "log") {
    function getTimestamp() {
        const d = new Date();
        const pad = (n, len = 2) => String(n).padStart(len, "0");

        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
             + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.`
             + `${pad(d.getMilliseconds(), 3)}`;
    }

    function getCallerLocation() {
        const stack = new Error().stack;

        if (!stack) return "unknown";

        const lines = stack.split("\n").map(line => line.trim());

        /*
            Usually:
            0 Error
            1 at getCallerLocation (...)
            2 at log (...)
            3 at ACTUAL_CALLER (...)
        */

        const callerLine = lines[3] || lines[2] || "";

        // Chrome-style stack:
        // at functionName (https://site/file.js:10:5)
        // at https://site/file.js:10:5
        const match =
            callerLine.match(/\((.*):(\d+):(\d+)\)$/) ||
            callerLine.match(/at (.*):(\d+):(\d+)$/);

        if (!match) return callerLine || "unknown";

        const fullPath = match[1];
        const line = match[2];
        const column = match[3];

        const file = fullPath.split("/").pop();

        return `${file}:${line}:${column}`;
    }

    let color;
    if (type === "warn") {
        color = "yellow";
    } else if (type === "error") {
        color = "red";
    } else if (type === "info") {
        color = "dodgerblue";
    } else {
        color = "gray";
    }

    const typeText = type.toUpperCase().padEnd(7, " ");
    const caller = getCallerLocation();

    console.log(
        `%c[mint] %c${getTimestamp()} %c${typeText} %c[${caller}] %c${content}`,
        "color: #85d890; font-weight: bold; font-family: monospace;",
        "color: white; font-family: monospace;",
        `color: ${color}; font-family: monospace;`,
        "color: #aaa; font-family: monospace;",
        "color: white; font-family: monospace;"
    );
}

// keep log here so it can be used before load

log("Running injector...", "info");
function injectHead(text) { document.head.insertAdjacentHTML("afterbegin", text); }

injectHead('<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Manrope">');
injectHead('<link rel="stylesheet" href="https://directprogrammer1.github.io/mint-client/assets/css/style.css">');

document.title = `Mint | ${document.title}`;

async function loadOverlay() {
    // load the overlay from overlay.html
    try {
        const res = await fetch(window.location.hostname !== "127.0.0.1" ? "https://directprogrammer1.github.io/mint-client/overlay.html" : "/overlay.html", { cache: "no-store" }); // allow for updating
        if (window.location.hostname === "127.0.0.1") log("Fetching from local file", "info")

        if (!res.ok) {
            log(`Failed to load overlay (error ${res.status}), error text: ${res.statusText}`, "warn");
            return;
        }

        const html = await res.text();
        
        document.body.insertAdjacentHTML("beforeend", html);
    } catch (e) {
        log(`Network error: ${e}`, "error");
        return;
    }
}

async function runScript(src) {
    try {
        const res = await fetch(src, { cache: "no-store" }); // No more caching.
        const script = await res.text();

        log(`Running script with src ${src}`, "info");

        eval(script);
    } catch (e) {
        log(`Failed to run script: ${e}`, "error");
    }
}

(async () => {
    if (window.location.hostname === "127.0.0.1") {
        log("Initializing via local files...", "info");

        injectHead('<link rel="stylesheet" href="https://directprogrammer1.github.io/mint-client/assets/css/style.css" />');

        await runScript("/assets/js/log.js"); // log is to be first initialized so that it can be used early on

        log("Loading overlay...", "info");
        await loadOverlay();
        log("Overlay loaded, running scripts...", "info");
        
        await runScript("/assets/js/main/client.js"); // Initialize client as second item
        await runScript("/assets/js/ui/overlay.js");
        await runScript("/assets/js/ui/tab.js");

        await runScript("/assets/js/main/chat.js");

        await runScript("/assets/js/main/terminal/main.js");
        await runScript("/assets/js/main/terminal/highlight.js");
        await runScript("/assets/js/main/terminal/window.js");
    } else {
        injectHead('<link rel="stylesheet" href="/assets/css/style.css" />');

        await runScript("https://directprogrammer1.github.io/mint-client/assets/js/log.js"); // log is to be first initialized so that it can be used early on

        log("Loading overlay...", "info");
        await loadOverlay();
        log("Overlay loaded, running scripts...", "info");
        
        await runScript("https://directprogrammer1.github.io/mint-client/assets/js/main/client.js"); // Initialize client as second item
        await runScript("https://directprogrammer1.github.io/mint-client/assets/js/ui/overlay.js");
        await runScript("https://directprogrammer1.github.io/mint-client/assets/js/ui/tab.js");

        await runScript("https://directprogrammer1.github.io/mint-client/assets/js/main/chat.js");

        await runScript("https://directprogrammer1.github.io/mint-client/assets/js/main/terminal/main.js");
        await runScript("https://directprogrammer1.github.io/mint-client/assets/js/main/terminal/highlight.js");
        await runScript("https://directprogrammer1.github.io/mint-client/assets/js/main/terminal/window.js");
    }
})();

// overlay should be hidden when not in fullscreen, otherwise can be shown with tab key/button