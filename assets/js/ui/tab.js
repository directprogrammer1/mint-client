const mintLog = (content, type = "log") => {
    if (typeof globalThis.log === "function") {
        globalThis.log(content, type);
    }
};

const OPEN_MAX_HEIGHT = "calc(320px * var(--scale))";
const OPEN_PADDING_Y = "calc(12.5px * var(--scale))";
const OPEN_MARGIN_TOP = "calc(10px * var(--scale))";

const tabs = [...document.querySelectorAll(".glass.tab")];

mintLog(`Tabs found: ${tabs.length}`, "info");

function getWidestTabWidth() {
    let widest = 0;

    for (const tab of tabs) {
        const clone = tab.cloneNode(true);
        const cloneBody = clone.querySelector(".glass.body");

        clone.classList.add("maximized");

        clone.style.position = "absolute";
        clone.style.visibility = "hidden";
        clone.style.pointerEvents = "none";
        clone.style.left = "-99999px";
        clone.style.top = "-99999px";
        clone.style.width = "max-content";
        clone.style.maxWidth = "none";
        clone.style.minWidth = "0";
        clone.style.height = "auto";

        if (cloneBody) {
            cloneBody.style.display = "flex";
            cloneBody.style.maxHeight = "none";
            cloneBody.style.opacity = "1";
            cloneBody.style.paddingTop = OPEN_PADDING_Y;
            cloneBody.style.paddingBottom = OPEN_PADDING_Y;
            cloneBody.style.marginTop = OPEN_MARGIN_TOP;
            cloneBody.style.overflow = "hidden";
        }

        tab.parentElement.appendChild(clone);

        const width = clone.getBoundingClientRect().width;
        widest = Math.max(widest, width);

        clone.remove();
    }

    return Math.ceil(widest);
}

function syncTabWidths() {
    tabs.forEach((tab) => {
        tab.style.width = "";
    });

    const widest = getWidestTabWidth();

    tabs.forEach((tab) => {
        tab.style.width = `${widest}px`;
    });

    mintLog(`Synced tab width: ${widest}px`, "info");
}

function openBody(tab, body) {
    body.style.display = "flex";
    body.style.overflow = "hidden";

    body.style.maxHeight = "0px";
    body.style.opacity = "0";
    body.style.paddingTop = "0px";
    body.style.paddingBottom = "0px";
    body.style.marginTop = "0px";

    tab.classList.add("maximized");

    requestAnimationFrame(() => {
        body.style.maxHeight = OPEN_MAX_HEIGHT;
        body.style.opacity = "1";
        body.style.paddingTop = OPEN_PADDING_Y;
        body.style.paddingBottom = OPEN_PADDING_Y;
        body.style.marginTop = OPEN_MARGIN_TOP;
    });
}

function closeBody(tab, body) {
    body.style.overflow = "hidden";
    body.style.display = "flex";

    body.style.maxHeight = `${body.getBoundingClientRect().height}px`;
    body.style.opacity = "1";
    body.style.paddingTop = OPEN_PADDING_Y;
    body.style.paddingBottom = OPEN_PADDING_Y;
    body.style.marginTop = OPEN_MARGIN_TOP;

    requestAnimationFrame(() => {
        body.style.maxHeight = "0px";
        body.style.opacity = "0";
        body.style.paddingTop = "0px";
        body.style.paddingBottom = "0px";
        body.style.marginTop = "0px";
    });

    const onEnd = (e) => {
        if (e.propertyName !== "max-height") return;

        body.style.display = "none";
        body.removeEventListener("transitionend", onEnd);
    };

    body.addEventListener("transitionend", onEnd);

    tab.classList.remove("maximized");
}

tabs.forEach((tab) => {
    const button = tab.querySelector('[name="minimax"]');
    const body = tab.querySelector(".glass.body");

    if (!button || !body) return;

    body.style.overflow = "hidden";

    if (!tab.classList.contains("maximized")) {
        body.style.display = "none";
        body.style.maxHeight = "0px";
        body.style.opacity = "0";
        body.style.paddingTop = "0px";
        body.style.paddingBottom = "0px";
        body.style.marginTop = "0px";
    } else {
        body.style.display = "flex";
        body.style.maxHeight = OPEN_MAX_HEIGHT;
        body.style.opacity = "1";
        body.style.paddingTop = OPEN_PADDING_Y;
        body.style.paddingBottom = OPEN_PADDING_Y;
        body.style.marginTop = OPEN_MARGIN_TOP;
    }

    button.addEventListener("click", () => {
        const isOpen = tab.classList.contains("maximized");

        if (isOpen) {
            closeBody(tab, body);
        } else {
            openBody(tab, body);
        }

        syncTabWidths();
    });
});

syncTabWidths();

window.addEventListener("resize", () => {
    syncTabWidths();
});

if (document.fonts) {
    document.fonts.ready.then(syncTabWidths);
}