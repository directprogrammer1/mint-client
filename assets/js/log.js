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

window.log = log;