// inject all link rel

function log(content, type = "log") {
    function getTimestamp() {
        const d = new Date();
        const pad = (n, len = 2) => String(n).padStart(len, "0");

        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
             + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.`
             + `${pad(d.getMilliseconds(), 3)}`;
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

    const typeText = type.toUpperCase().padEnd(7, " "); // fixed width

    console.log(
        `%c[mint] %c${getTimestamp()} %c${typeText} %c${content}`,
        "color: #85d890; font-weight: bold; font-family: monospace;",
        "color: white; font-family: monospace;",
        `color: ${color}; font-family: monospace;`,
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
        const res = await fetch("https://directprogrammer1.github.io/mint-client/overlay.html", { cache: "no-store" }); // allow for updating
        
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
    await runScript("https://directprogrammer1.github.io/mint-client/assets/js/log.js"); // log is to be first initialized so that it can be used early on

    log("Loading overlay...", "info");
    await loadOverlay();
    log("Overlay loaded, running scripts...", "info");
    
    await runScript("https://directprogrammer1.github.io/mint-client/assets/js/client.js"); // Initialize client as second item
    await runScript("https://directprogrammer1.github.io/mint-client/assets/js/ui/overlay.js");
    await runScript("https://directprogrammer1.github.io/mint-client/assets/js/ui/tab.js");

    await runScript("https://directprogrammer1.github.io/mint-client/assets/js/main/chat.js");

    await runScript("https://directprogrammer1.github.io/mint-client/assets/js/terminal/main.js");
    await runScript("https://directprogrammer1.github.io/mint-client/assets/js/terminal/highlight.js");
})();

// overlay should be hidden when not in fullscreen, otherwise can be shown with tab key/button