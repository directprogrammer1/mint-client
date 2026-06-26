try {
    log(`Command text element found: ${cmdText}`, "info");
} catch (e) {
    cmdText = document.getElementById("cmd-text");
}

try {
    log(`Terminal content element found: ${terminalContent}`, "info");
} catch (e) {
    terminalContent = document.getElementById("terminal-content");
}

cmdText.setAttribute('contenteditable', 'plaintext-only');
cmdText.spellcheck = false;
cmdText.style.whiteSpace = 'pre-wrap';
cmdText.style.outline = 'none';

function removeEmptyContinuationLine(event) {
    if (event.key !== "Backspace") {
        return false;
    }

    const text = readEditorText(cmdText);
    const caretOffset = getCaretOffset(cmdText);

    // Caret must be directly after a newline, meaning the current line is empty.
    if (
        caretOffset === 0 ||
        text[caretOffset - 1] !== "\n"
    ) {
        return false;
    }

    event.preventDefault();
    event.stopPropagation();

    const newText =
        text.slice(0, caretOffset - 1) +
        text.slice(caretOffset);

    cmdText.innerHTML = highlightText(newText);

    setCaretPosition(
        cmdText,
        caretOffset - 1
    );

    updateTerminalStartLines(newText);

    return true;
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function readEditorText(element = cmdText) {
    let text = "";

    const visit = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            text += node.nodeValue || "";
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        if (node.tagName === "BR") {
            // Ignore the extra BR used to make the final line editable.
            if (node.dataset?.terminalSentinel === "true") {
                return;
            }

            // Ignore filler BRs automatically created by contenteditable.
            if (node.dataset?.terminalBreak !== "true") {
                return;
            }

            text += "\n";
            return;
        }

        node.childNodes.forEach(visit);
    };

    element.childNodes.forEach(visit);

    return text
        .replace(/\u00A0/g, " ")
        .replace(/\r/g, "");
}

function getCaretOffset(element) {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        return 0;
    }

    const activeRange = selection.getRangeAt(0);

    if (!element.contains(activeRange.startContainer)) {
        return readEditorText(element).length;
    }

    const beforeCaret = activeRange.cloneRange();

    beforeCaret.selectNodeContents(element);
    beforeCaret.setEnd(
        activeRange.startContainer,
        activeRange.startOffset
    );

    const holder = document.createElement("div");
    holder.appendChild(beforeCaret.cloneContents());

    return readEditorText(holder).length;
}

function setCaretPosition(element, requestedOffset) {
    let remaining = Math.max(0, requestedOffset);
    let target = null;

    const search = (parent) => {
        for (let index = 0; index < parent.childNodes.length; index++) {
            const child = parent.childNodes[index];

            if (child.nodeType === Node.TEXT_NODE) {
                const length = (child.nodeValue || "").length;

                if (remaining <= length) {
                    target = {
                        node: child,
                        offset: remaining
                    };

                    return true;
                }

                remaining -= length;
                continue;
            }

            if (child.nodeType !== Node.ELEMENT_NODE) {
                continue;
            }

            if (child.dataset?.terminalSentinel === "true") {
                continue;
            }

            if (child.tagName === "BR") {
                // Ignore both the sentinel and browser-generated filler BRs.
                if (
                    child.dataset?.terminalSentinel === "true" ||
                    child.dataset?.terminalBreak !== "true"
                ) {
                    continue;
                }
            }

            if (search(child)) {
                return true;
            }
        }

        return false;
    };

    search(element);

    const range = document.createRange();
    const selection = window.getSelection();

    if (target) {
        range.setStart(target.node, target.offset);
    } else {
        range.selectNodeContents(element);
        range.collapse(false);
    }

    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
}

function isWhitespaceToken(token) {
    return /^\s+$/.test(token);
}

function tokenizeHighlightLine(line) {
    const tokens = [];
    let i = 0;
    let normalTokenIndex = 0;

    const push = (text, type = "word", forcedTokenIndex = undefined) => {
        const whitespace = type === "whitespace";

        tokens.push({
            text,
            type,
            whitespace,
            tokenIndex: whitespace
                ? null
                : forcedTokenIndex ?? normalTokenIndex++
        });
    };

    const readQuoted = (quoteChar) => {
        let value = quoteChar;
        i++;

        while (i < line.length) {
            const ch = line[i];
            value += ch;
            i++;

            if (ch === "\\" && i < line.length) {
                value += line[i];
                i++;
                continue;
            }

            if (ch === quoteChar) {
                break;
            }
        }

        return value;
    };

    const readNormalWord = () => {
        let value = "";

        while (i < line.length) {
            const ch = line[i];

            if (/\s/.test(ch)) break;
            if (ch === '"' || ch === "'") break;
            if (ch === "{") break;
            if (ch === "=") break;
            if (ch === "&" && line[i + 1] === "&") break;
            if (ch === "|" && line[i + 1] === "|") break;

            value += ch;
            i++;
        }

        return value;
    };

    const readMathWord = () => {
        let value = "";

        while (i < line.length) {
            const ch = line[i];

            if (/\s/.test(ch)) break;
            if (ch === '"' || ch === "'") break;
            if (ch === "}") break;
            if ("+-*/()".includes(ch)) break;
            if (ch === "&" && line[i + 1] === "&") break;
            if (ch === "|" && line[i + 1] === "|") break;

            value += ch;
            i++;
        }

        return value;
    };

    const readBracedMath = () => {
        push("{", "symbol");
        i++;

        while (i < line.length) {
            const ch = line[i];

            if (/\s/.test(ch)) {
                let value = "";
                while (i < line.length && /\s/.test(line[i])) {
                    value += line[i];
                    i++;
                }
                push(value, "whitespace");
                continue;
            }

            if (ch === '"' || ch === "'") {
                push(readQuoted(ch), "string");
                continue;
            }

            if (ch === "}") {
                push("}", "symbol");
                i++;
                return;
            }

            if (ch === "&" && line[i + 1] === "&") {
                push("&&", "symbol");
                i += 2;
                continue;
            }

            if (ch === "|" && line[i + 1] === "|") {
                push("||", "symbol");
                i += 2;
                continue;
            }

            if ("+-*/()".includes(ch)) {
                push(ch, "symbol");
                i++;
                continue;
            }

            const word = readMathWord();

            if (word) {
                push(word, classifyWord(word));
            } else {
                push(line[i], "word");
                i++;
            }
        }
    };

    const classifyWord = (word) => {
        if (/^("[^"]*"|'[^']*')$/.test(word)) {
            return "string";
        }

        if (/^\$[A-Za-z_][A-Za-z0-9_]*$/.test(word)) {
            return "variable";
        }

        return "word";
    };

    const pushNormalWord = (word) => {
        // Only split package.command on the first real token
        if (normalTokenIndex === 0) {
            const dotIndex = word.indexOf(".");

            if (dotIndex > 0 && dotIndex < word.length - 1) {
                const packageName = word.slice(0, dotIndex);
                const commandName = word.slice(dotIndex + 1);

                push(packageName, "package", 0);
                push(".", "namespace-dot", 0);
                push(commandName, "command", 0);

                normalTokenIndex++;
                return;
            }
        }

        push(word, classifyWord(word));
    };

    while (i < line.length) {
        const ch = line[i];

        if (/\s/.test(ch)) {
            let value = "";

            while (i < line.length && /\s/.test(line[i])) {
                value += line[i];
                i++;
            }

            push(value, "whitespace");
            continue;
        }

        if (ch === '"' || ch === "'") {
            push(readQuoted(ch), "string");
            continue;
        }

        if (ch === "{") {
            readBracedMath();
            continue;
        }

        if (ch === "&" && line[i + 1] === "&") {
            push("&&", "symbol");
            i += 2;
            continue;
        }

        if (ch === "|" && line[i + 1] === "|") {
            push("||", "symbol");
            i += 2;
            continue;
        }

        if (ch === "=") {
            push("=", "symbol");
            i++;
            continue;
        }

        const word = readNormalWord();

        if (word) {
            pushNormalWord(word);
        } else {
            push(line[i], "word");
            i++;
        }
    }

    return tokens;
}

function getHighlightClass(token, tokens) {
    if (token.whitespace) {
        return "";
    }

    if (token.type === "package") {
        return "terminal-package";
    }

    if (token.type === "namespace-dot") {
        return "";
    }

    if (token.type === "command") {
        return "terminal-command";
    }

    if (token.tokenIndex === 0) {
        if (token.text === "repeat" || token.text === "endloop" || token.text === "loopend") {
            return "terminal-loop";
        }
        return "terminal-command";
    }

    if (token.type === "string") {
        return "terminal-string";
    }

    if (token.type === "symbol") {
        return "terminal-symbol";
    }

    if (token.type === "variable") {
        return "terminal-var";
    }

    const nextRealToken = tokens.find(t => t.tokenIndex === token.tokenIndex + 1);

    if (nextRealToken && nextRealToken.text === "=") {
        return "terminal-argument";
    }

    return "";
}

function getTerminalStart() {
    return document.getElementById("terminal-start");
}

function getPromptText() {
    const terminalStart = getTerminalStart();

    if (!terminalStart) {
        return window.terminal?.prompt || "C:\\>";
    }

    // Save the original prompt before we add <br> and dots.
    if (!terminalStart.dataset.basePrompt) {
        terminalStart.dataset.basePrompt =
            terminalStart.textContent || window.terminal?.prompt || "C:\\>";
    }

    return terminalStart.dataset.basePrompt;
}

function getContinuationMarker() {
    return ".".repeat(getPromptText().length);
}

function updateTerminalStartLines(text = readEditorText(cmdText)) {
    const terminalStart = getTerminalStart();

    if (!terminalStart) {
        return;
    }

    const promptText = getPromptText();
    const lineCount = text.split("\n").length;

    // Remove the existing prompt and continuation markers.
    terminalStart.replaceChildren(
        document.createTextNode(promptText)
    );

    // Add one <br> and marker for every extra command line.
    for (let line = 1; line < lineCount; line++) {
        terminalStart.appendChild(
            document.createElement("br")
        );

        terminalStart.appendChild(
            document.createTextNode(
                getContinuationMarker()
            )
        );
    }
}

function splitContinuationLine(line) {
    return {
        prefix: "",
        commandText: line
    };
}

function highlightCommandLine(line) {
    const tokens = tokenizeHighlightLine(line);

    return tokens.map((token) => {
        const escaped = escapeHtml(token.text);
        const className = getHighlightClass(token, tokens);

        if (!className) {
            return escaped;
        }

        return `<span class="${escapeHtml(className)}">${escaped}</span>`;
    }).join("");
}

function highlightText(text) {
    const highlighted = text
        .split("\n")
        .map((line) => highlightCommandLine(line))
        .join('<br data-terminal-break="true">');

    if (text.endsWith("\n")) {
        return highlighted + '<br data-terminal-sentinel="true">';
    }

    return highlighted;
}

function updateHighlight(forcedCaretOffset = null) {
    const text = readEditorText(cmdText);

    const caretOffset =
        forcedCaretOffset ?? getCaretOffset(cmdText);

    cmdText.innerHTML = highlightText(text);

    setCaretPosition(
        cmdText,
        Math.min(caretOffset, text.length)
    );

    updateTerminalStartLines(text);
}

function insertTextAtCaret(text) {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        cmdText.appendChild(document.createTextNode(text));
        updateHighlight(readEditorText(cmdText).length);
        return;
    }

    const range = selection.getRangeAt(0);

    if (!cmdText.contains(range.startContainer)) {
        cmdText.focus({
            preventScroll: true
        });

        setCaretPosition(
            cmdText,
            readEditorText(cmdText).length
        );

        insertTextAtCaret(text);
        return;
    }

    const originalOffset = getCaretOffset(cmdText);

    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);

    updateHighlight(originalOffset + text.length);
}

function getInputCommands(text = readEditorText(cmdText)) {
    return text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function getCommandName(commandText) {
    const tokens = terminal.tokenizeCommand(commandText);

    if (tokens.length === 0) {
        return "";
    }

    return String(
        terminal.resolveNormalToken(tokens[0])
    ).toLowerCase();
}

function getUnclosedLoopDepth(commands) {
    let depth = 0;

    commands.forEach((commandText) => {
        const commandName = getCommandName(commandText);

        if (commandName === "repeat") {
            depth++;
            return;
        }

        if (
            commandName === "endloop" ||
            commandName === "loopend"
        ) {
            depth = Math.max(0, depth - 1);
        }
    });

    return depth;
}

function insertContinuationLine() {
    insertTextAtCaret("\n");
}

cmdText.addEventListener("input", () => {
    updateHighlight();
});

cmdText.addEventListener("paste", (event) => {
    event.preventDefault();

    const pastedText = (
        event.clipboardData ||
        window.clipboardData
    )
        .getData("text")
        .replace(/\r\n?/g, "\n");

    insertTextAtCaret(pastedText);
});

cmdText.addEventListener("dragstart", (event) => {
    event.preventDefault();
});

cmdText.addEventListener("drop", (event) => {
    event.preventDefault();
});

cmdText.addEventListener("dragover", (event) => {
    event.preventDefault();
});

function writeCommandFromInput(
    text = readEditorText(cmdText)
) {
    const inputRow = document.querySelector(
        "#terminal-content .terminal-row"
    );

    if (!inputRow) {
        return;
    }

    const wrapper = document.createElement("div");

    wrapper.className =
        "terminal-output-line terminal-command-line";

    text.split("\n").forEach((line, lineIndex) => {
        if (lineIndex > 0) {
            wrapper.appendChild(
                document.createElement("br")
            );
        }

        const commandText = line;

        const prefixSpan =
            document.createElement("span");

        if (lineIndex === 0) {
            prefixSpan.className =
                "terminal-prompt-output";

            prefixSpan.textContent =
                getPromptText();
        } else {
            prefixSpan.className =
                "terminal-alignment-dots";

            prefixSpan.textContent =
                getContinuationMarker();
        }

        wrapper.appendChild(prefixSpan);

        const commandSpan =
            document.createElement("span");

        commandSpan.className =
            "terminal-command-output";

        commandSpan.innerHTML =
            highlightCommandLine(commandText);

        wrapper.appendChild(commandSpan);
    });

    terminalContent.insertBefore(
        wrapper,
        inputRow
    );

    terminalContent.scrollTop =
        terminalContent.scrollHeight;
}

function runCommand(command) {
    return terminal.executeCommand(command);
}

function handleEnterKey(event) {
    if (event.key !== "Enter") {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Shift+Enter always inserts another command line.
    if (event.shiftKey) {
        insertContinuationLine();
        return;
    }

    const fullText = readEditorText(cmdText);
    const commands = getInputCommands(fullText);

    if (commands.length === 0) {
        return;
    }

    // Normal Enter also creates a new line while a repeat
    // block is waiting for its matching endloop.
    if (getUnclosedLoopDepth(commands) > 0) {
        insertContinuationLine();
        return;
    }

    writeCommandFromInput(fullText);

    commands.forEach((command) => {
        runCommand(command);
    });

    cmdText.innerHTML = "";

    updateTerminalStartLines("");

    cmdText.focus({
        preventScroll: true
    });
}

cmdText.addEventListener("keydown", (event) => {
    if (removeEmptyContinuationLine(event)) {
        return;
    }

    handleEnterKey(event);
});