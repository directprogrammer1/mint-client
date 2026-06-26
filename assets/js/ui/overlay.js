// if fullscreen the style attribute will be shown, check every time with a mutationObserver

window.isOverlayShown = false;
window.isWarningShown = false;

// !--- DEBUG --- !

if (window.location.hostname === "127.0.0.1") {
    window.isOverlayShown = true;
}

// !--- DEBUG end --- !

function checkFullscreen() {
    if (!["scratch.mit.edu", "turbowarp.org", "forkphorus.github.io"].includes(window.location.hostname)) return true; // debug purposes
    if (window.location.pathname.includes("/fullscreen")) return true;
    return false;
}

function injectHead(text) { document.head.insertAdjacentHTML("afterbegin", text); }

function setFavicon() {
    document.querySelectorAll('link[rel~="icon"]').forEach(el => el.remove());
    injectHead('<link rel="icon" type="image/x-icon" href="https://directprogrammer1.github.io/mint-client/assets/mint-logo.ico">');
}

if (window.overlayMutationObserver) {
    window.overlayMutationObserver.disconnect();
}

window.overlayMutationObserver = new MutationObserver(() => {
    window.overlayMutationObserver.disconnect(); // overlay can be shown which would cause a crash

    const toShow = document.querySelectorAll('div[name="show-toggle"]');
    if (toShow.length === 0) {
        window.overlayMutationObserver.observe(document.body, { attributes: true, subtree: true });
        return;
    }

    const isFullscreen = true;

    if (!isFullscreen) window.isOverlayShown = false;

    toShow.forEach(el => el.classList.toggle("show", window.isOverlayShown));

    setFavicon();
    window.overlayMutationObserver.observe(document.body, { attributes: true, subtree: true });
});

if (window.overlayKeydownHandler) {
    document.removeEventListener("keydown", window.overlayKeydownHandler);
}

window.overlayKeydownHandler = (e) => {
    if (e.key !== "Tab") return;

    const toShow = document.querySelectorAll('div[name="show-toggle"]');
    if (toShow.length === 0) {
        console.warn("Overlay elements not loaded yet.");
        return;
    }

    const isProjectFullscreen = checkFullscreen();

    if (isProjectFullscreen) {
        window.isOverlayShown = !window.isOverlayShown;
        toShow.forEach(el => el.classList.toggle("show", window.isOverlayShown));
        e.preventDefault();
        return;
    }

    if (window.isWarningShown) {
        e.preventDefault();
        return;
    }

    window.isWarningShown = true;

    const warning = document.getElementById("warning");
    if (warning) {
        warning.textContent = "Please enter project fullscreen to show the overlay.";
        warning.style.opacity = "1";
        warning.style.transform = "translateY(0px)";
    }

    setTimeout(() => {
        if (warning) {
            warning.style.opacity = "0";
            warning.style.transform = "translateY(10px)";
        }

        window.isOverlayShown = false;
        toShow.forEach(el => el.classList.remove("show"));
        window.isWarningShown = false;
    }, 2000);

    e.preventDefault();
};

document.addEventListener("keydown", window.overlayKeydownHandler);

const windows = document.querySelectorAll('[name="drag-move"]');

let topZIndex = 100000001;

function bringToFront(win) {
    topZIndex++;

    // reset so no infinitely increasing z-index values which can cause issues in some browsers
    // also it looks better in-debug/in other locations rather than having 99999999999999999999999999999999999999999999999.
    if (topZIndex > 100000500) {
        normalizeWindowZIndexes();
    }

    win.style.zIndex = String(topZIndex);
    document.querySelector(".menubar-wrapper").style.zIndex = String(topZIndex + 1);
}

function normalizeWindowZIndexes() {
    const windows = [...document.querySelectorAll('[name="drag-move"]')];

    windows.sort((a, b) => {
        return Number(getComputedStyle(a).zIndex || 0) - Number(getComputedStyle(b).zIndex || 0);
    });

    topZIndex = 100000001;

    for (const win of windows) {
        win.style.zIndex = String(++topZIndex);
    }
}

windows.forEach((win) => {
    win.style.position = getComputedStyle(win).position === "static"
        ? "absolute"
        : getComputedStyle(win).position;

    win.style.zIndex = String(++topZIndex);

    const header = win.querySelector(".drag-header");
    if (!header) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    const startDrag = (clientX, clientY) => {
        const rect = win.getBoundingClientRect();

        // convert from bottom/right CSS positioning to left/top
        // also set z-index as to bring window to front
        // window should also be brought to front when opened
        win.style.left = rect.left + "px";
        win.style.top = rect.top + "px";
        win.style.right = "auto";
        win.style.bottom = "auto";

        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;
        isDragging = true;
    };

    const moveDrag = (clientX, clientY) => {
        if (!isDragging) return;

        const left = clientX - offsetX;
        const top = clientY - offsetY;

        const maxLeft = window.innerWidth - win.offsetWidth;
        const maxTop = window.innerHeight - win.offsetHeight;

        win.style.left = Math.max(0, Math.min(left, maxLeft)) + "px";
        win.style.top = Math.max(0, Math.min(top, maxTop)) + "px";
    };

    const endDrag = () => {
        isDragging = false;
    };

    header.addEventListener("mousedown", (e) => {
        // don't start dragging if clicking a button/input inside the header
        if (e.target.closest("button, input, textarea, select")) return;

        e.preventDefault();

        bringToFront(win);

        startDrag(e.clientX, e.clientY);
    });

    win.addEventListener("mousedown", () => bringToFront(win));
    win.addEventListener("touchstart", () => bringToFront(win), { passive: true });

    document.addEventListener("mousemove", (e) => {
        moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener("mouseup", endDrag);

    // touch support
    header.addEventListener("touchstart", (e) => {
        if (e.target.closest("button, input, textarea, select")) return;

        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        moveDrag(touch.clientX, touch.clientY);
    }, { passive: true });

    document.addEventListener("touchend", endDrag);
});

document.addEventListener("keydown", window.overlayKeydownHandler);

window.overlayMutationObserver.observe(document.body, { attributes: true, subtree: true });

// closing function for now