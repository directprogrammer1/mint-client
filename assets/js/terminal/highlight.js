if (typeof(cmdText) === "undefined") {
    const cmdText = document.getElementById("cmd-text");
}

cmdText.setAttribute('contenteditable', 'plaintext-only');
cmdText.spellcheck = false;
cmdText.style.whiteSpace = 'pre-wrap';
cmdText.style.outline = 'none';

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getTextOffset(root, node, offset) {
    let chars = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
        const current = walker.currentNode;
        if (current === node) {
            return chars + offset;
        }
        chars += current.nodeValue.length;
    }
    return chars;
}

function getCaretOffset(element) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return 0;
    }
    const range = selection.getRangeAt(0);
    return getTextOffset(element, range.startContainer, range.startOffset);
}

function setCaretPosition(element, chars) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
    let node = walker.nextNode();
    let accumulated = 0;
    while (node) {
        const nextAccumulated = accumulated + node.nodeValue.length;
        if (chars <= nextAccumulated) {
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStart(node, chars - accumulated);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
        }
        accumulated = nextAccumulated;
        node = walker.nextNode();
    }
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
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

function highlightText(text) {
    const lines = text.split("\n");

    return lines
        .map((line) => {
            const tokens = tokenizeHighlightLine(line);

            return tokens.map((token) => {
                const escaped = escapeHtml(token.text);
                const cls = getHighlightClass(token, tokens);

                if (!cls) {
                    return escaped;
                }

                return `<span class="${escapeHtml(cls)}">${escaped}</span>`;
            }).join("");
        })
        .join("<br>");
}

function updateHighlight() {
    const text = cmdText.textContent.replace(/\u00A0/g, ' ');
    const caretOffset = getCaretOffset(cmdText);
    cmdText.innerHTML = highlightText(text);
    setCaretPosition(cmdText, Math.min(caretOffset, text.length));
}

cmdText.addEventListener('input', updateHighlight);
cmdText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
    }
});

cmdText.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = (event.clipboardData || window.clipboardData).getData('text');
    document.execCommand('insertText', false, text);
});

const fakeCaret = document.getElementById("fake-caret");

terminalContent.addEventListener("mousedown", (e) => {
    if (!terminalContent.contains(e.target)) {
        fakeCaret.style.display = "none";
        return;
    }

    if (e.target === terminalContent || e.target === fakeCaret || (e.target.classList && e.target.classList.contains('terminal-row'))) {
        cmdText.focus();
        const range = document.createRange();
        range.selectNodeContents(cmdText);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        fakeCaret.style.display = "inline-block";
        e.preventDefault();
        return;
    }
});

terminalContent.addEventListener("click", () => {
    cmdText.focus();
    fakeCaret.style.display = "inline-block";
});

cmdText.addEventListener("dragstart", (e) => {
    e.preventDefault();
});

cmdText.addEventListener("drop", (e) => {
    e.preventDefault();
});

cmdText.addEventListener("dragover", (e) => {
    e.preventDefault();
});

function writeCommandFromInput() {
    const inputRow = document.querySelector("#terminal-content .terminal-row");
    const terminalStart = document.getElementById("terminal-start");
    const cmdText = document.getElementById("cmd-text");

    if (!inputRow || !terminalStart || !cmdText) return;

    const line = document.createElement("div");
    line.className = "terminal-output-line terminal-command-line";

    const promptSpan = document.createElement("span");
    promptSpan.className = "terminal-prompt-output";
    promptSpan.textContent = terminalStart.textContent;

    const commandSpan = document.createElement("span");
    commandSpan.className = "terminal-command-output";

    // preserves the highlighted spans inside cmdText
    commandSpan.innerHTML = cmdText.innerHTML;

    line.appendChild(promptSpan);
    line.appendChild(commandSpan);

    terminalContent.insertBefore(line, inputRow);
    terminalContent.scrollTop = terminalContent.scrollHeight;
}

function handleEnterKey(e) {
    if (e.key !== "Enter") return;

    e.preventDefault();

    const command = cmdText.textContent.trim();

    if (command.length === 0) return;

    writeCommandFromInput(); // preserve coloring

    cmdText.textContent = "";
    runCommand(command);
}

cmdText.addEventListener("keydown", (e) => {
    handleEnterKey(e);
});