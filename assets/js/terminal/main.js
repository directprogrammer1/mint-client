const cmdText = document.getElementById("cmd-text");
const terminalContent = document.getElementById("terminal-content")

class MintTerminal {
    constructor() {
        this.commands = new Map();
        this.packageCommands = new Map();
        this.packages = new Map();
        this.variables = {};

        this.prompt = "C:\\>";
    }

    resolveCommandInfo(commandText) {
        const rawCommand = String(commandText || "");
        const dotIndex = rawCommand.indexOf(".");

        if (dotIndex !== -1) {
            const packageName = rawCommand.slice(0, dotIndex);
            const commandName = rawCommand.slice(dotIndex + 1);

            if (packageName === "default") {
                return {
                    error: "[red]Do not use 'default.command' for default commands."
                };
            }

            if (!packageName || !commandName) {
                return {
                    error: "[red]Invalid namespaced command. Use [package].[command]"
                };
            }

            const packageMap = this.packageCommands.get(packageName.toLowerCase());

            if (!packageMap) {
                return {
                    error: `[red]Package '${packageName}' does not exist or has not yet been installed.`
                };
            }

            const commandInfo = packageMap.get(commandName.toLowerCase());

            if (!commandInfo) {
                return {
                    error: `[red]Package '${packageName}' has no command '${commandName}'.`
                };
            }

            return {
                commandInfo,
                realCommandName: commandName
            };
        }

        const commandInfo = this.commands.get(rawCommand.toLowerCase());

        if (!commandInfo) {
            return {
                error: `[red]'${rawCommand}' is not recognized as an internal or external command, operatable program, or batch file.`
            };
        }

        if (commandInfo.ambiguous) {
            return {
                error: `[red]'${rawCommand}' exists in multiple packages. Use package.${rawCommand} instead.`
            };
        }

        return {
            commandInfo,
            realCommandName: rawCommand
        };
    }

    installPackage(PackageClass, options = {}) {
        // Create package instance if a class was passed
        const packageInstance = typeof PackageClass === "function"
            ? new PackageClass(this, options)
            : PackageClass;

        if (!packageInstance) {
            throw new Error("Invalid package.");
        }

        // Static packageInfo lives on constructor
        const rawInfo =
            packageInstance.packageInfo ||
            packageInstance.constructor.packageInfo;

        if (!rawInfo || typeof rawInfo !== "object") {
            throw new Error("Package must have static packageInfo.");
        }

        if (!rawInfo.name) {
            throw new Error("Package packageInfo must include a name.");
        }

        const packageInfo = {
            name: rawInfo.name,
            version: rawInfo.version || "unknown",
            type: rawInfo.type || "normal",
            category: rawInfo.category || "Other",
            description: rawInfo.description || "",
            ...rawInfo
        };

        const packageName = packageInfo.name;

        if (this.packages.has(packageName)) {
            throw new Error(`Package already installed: ${packageName}`);
        }

        // Save packageInfo onto the instance for easy access later
        packageInstance.packageInfo = packageInfo;

        // Store installed package
        this.packages.set(packageName, packageInstance);

        // Optional install hook
        if (typeof packageInstance.onInstall === "function") {
            packageInstance.onInstall(this);
        }

        // Commands can be static or instance-based
        const commandList =
            packageInstance.commands ||
            packageInstance.constructor.commands ||
            {};

        for (const [commandName, commandData] of Object.entries(commandList)) {
            let methodName;
            let argCount = null;

            if (Array.isArray(commandData)) {
                methodName = commandData[0];
                argCount = commandData[1] ?? null;
            } else {
                methodName = commandData;
            }

            this.registerCommand(commandName, packageName, methodName, argCount);
        }

        return packageInstance;
    }

    registerCommand(commandName, packageName, methodName, argCount) {
        const normalizedCommand = commandName.toLowerCase();
        const normalizedPackage = packageName.toLowerCase();

        const commandInfo = {
            commandName,
            packageName,
            methodName,
            argCount
        };

        // Store command inside its package namespace
        if (!this.packageCommands.has(normalizedPackage)) {
            this.packageCommands.set(normalizedPackage, new Map());
        }

        const packageCommandMap = this.packageCommands.get(normalizedPackage);

        if (packageCommandMap.has(normalizedCommand)) {
            throw new Error(`Command already exists in package '${packageName}': ${commandName}`);
        }

        packageCommandMap.set(normalizedCommand, commandInfo);

        // Also register it globally, unless another package already has this command
        if (this.commands.has(normalizedCommand)) {
            this.commands.set(normalizedCommand, {
                ambiguous: true,
                commandName
            });
            return;
        }

        this.commands.set(normalizedCommand, commandInfo);
    }

    executeCommand(commandSyntax) {
        commandSyntax = String(commandSyntax || "").trim();

        if (commandSyntax.length === 0) {
            return "";
        }

        const parsed = this.parseCommand(commandSyntax);

        if (!parsed.command) {
            return "";
        }

    const resolved = this.resolveCommandInfo(parsed.command);

    if (resolved.error) {
        this.writeLines(resolved.error);
        return "";
    }

    const commandInfo = resolved.commandInfo;
    const realCommandName = resolved.realCommandName;

        if (typeof commandInfo.argCount === "number") {
            if (commandInfo.argCount >= 0 && parsed.args.length !== commandInfo.argCount) {
                this.writeLines(
                    `[red]'${parsed.command}' expected ${commandInfo.argCount} arg(s), got ${parsed.args.length}.`
                );
                return "";
            }

            if (commandInfo.argCount === -1) {
                // -1 means kwargs mode / unlimited key=value options.
                // Example: command key=value other=something
                // This blocks random normal args.
                if (parsed.args.length > 0) {
                    this.writeLines(
                        `[red]'${parsed.command}' only accepts key=value arguments.`
                    );
                    return "";
                }
            }
        }

        const pkg = this.packages.get(commandInfo.packageName);

        if (!pkg) {
            this.writeLines(`[red]Package not loaded: ${commandInfo.packageName}`);
            return "";
        }

        const fn = pkg[commandInfo.methodName];

        if (typeof fn !== "function") {
            this.writeLines(`[red]Command function missing: ${commandInfo.methodName}`);
            return "";
        }

        const context = {
            terminal: this,
            package: pkg,
            input: commandSyntax,
            command: realCommandName,
            fullCommand: parsed.command,
            packageName: commandInfo.packageName,
            args: parsed.args,
            kwargs: parsed.kwargs
        };

        try {
            const result = fn.call(pkg, context);

            if (result !== undefined && result !== null && result !== "") {
                this.writeLines(result);
            }

            return result;
        } catch (err) {
            this.writeLines(`[red] Error: ${err.message}`);
            console.error(err);
            return "";
        }
    }

    evaluateExpression(tokens) {
        let pos = 0;

        const parseConcat = () => {
            let result = parseExpr();

            while (pos < tokens.length && (tokens[pos] === "&&" || tokens[pos] === "||")) {
                const op = tokens[pos++];
                const right = parseExpr();

                if (op === "&&") {
                    result = String(result) + String(right);
                } else if (op === "||") {
                    result = result || right;
                }
            }

            return result;
        };

        const parseExpr = () => {
            let result = parseTerm();

            while (pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
                const op = tokens[pos++];
                const right = parseTerm();

                if (typeof result !== "number" || typeof right !== "number") {
                    throw new Error("Cannot perform arithmetic on non-numeric values");
                }

                if (op === "+") result += right;
                else result -= right;
            }

            return result;
        };

        const parseTerm = () => {
            let result = parseFactor();

            while (pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/")) {
                const op = tokens[pos++];
                const right = parseFactor();

                if (typeof result !== "number" || typeof right !== "number") {
                    throw new Error("Cannot perform arithmetic on non-numeric values");
                }

                if (op === "*") {
                    result *= right;
                } else {
                    if (right === 0) throw new Error("Division by zero");
                    result /= right;
                }
            }

            return result;
        };

        const parseFactor = () => {
            if (tokens[pos] === "+") {
                pos++;
                return parseFactor();
            }

            if (tokens[pos] === "-") {
                pos++;
                const value = parseFactor();

                if (typeof value !== "number") {
                    throw new Error("Cannot negate a non-number");
                }

                return -value;
            }

            if (tokens[pos] === "(") {
                pos++;
                const result = parseConcat();

                if (pos >= tokens.length || tokens[pos] !== ")") {
                    throw new Error("Mismatched parentheses");
                }

                pos++;
                return result;
            }

            return parseValue();
        };

        const parseValue = () => {
            if (pos >= tokens.length) {
                throw new Error("Unexpected end of expression");
            }

            const token = tokens[pos++];

            if (token.startsWith("{") && token.endsWith("}")) {
                const inner = token.slice(1, -1);
                const innerTokens = this.tokenizeCommand(inner, { mathMode: true });
                return this.evaluateExpression(innerTokens);
            }

            const resolved = this.resolveNormalToken(token);

            if (
                typeof resolved === "number" ||
                (typeof resolved === "string" && resolved.trim() !== "" && !Number.isNaN(Number(resolved)))
            ) {
                return Number(resolved);
            }

            return resolved;
        };

        const result = parseConcat();

        if (pos < tokens.length) {
            throw new Error(`Unexpected token: ${tokens[pos]}`);
        }

        return result;
    }

    resolveNormalToken(token) {
        const stripped = this.stripQuotes(String(token));
        const value = stripped.value;

        if (!stripped.wasQuoted && value.startsWith("$")) {
            const varName = value.slice(1);

            if (Object.prototype.hasOwnProperty.call(this.variables, varName)) {
                return this.variables[varName];
            }

            return value;
        }

        return value;
    }

    resolveArgumentToken(token) {
        token = String(token);

        if (token.startsWith("{") && token.endsWith("}")) {
            const inner = token.slice(1, -1);
            const expressionTokens = this.tokenizeExpression(inner);
            return this.evaluateExpression(expressionTokens, { strictNumbers: true });
        }

        return this.resolveNormalToken(token);
    }

    parseCommand(input) {
        const tokens = this.tokenizeCommand(input);

        if (tokens.length === 0) {
            return {
                command: "",
                args: [],
                kwargs: {}
            };
        }

        const command = this.resolveNormalToken(tokens[0]);
        const args = [];
        const kwargs = {};

        let i = 1;

        while (i < tokens.length) {
            const token = tokens[i];

            if (tokens[i + 1] === "=" && i + 2 < tokens.length) {
                const key = this.resolveNormalToken(token);
                const valueToken = tokens[i + 2];

                try {
                    kwargs[key] = this.resolveArgumentToken(valueToken);
                } catch (err) {
                    this.writeLines(`[red]Expression error in '${key}': ${err.message}`);
                    return { command: "", args: [], kwargs: {} };
                }

                i += 3;
                continue;
            }

            if (token === "=") {
                i++;
                continue;
            }

            try {
                args.push(this.resolveArgumentToken(token));
            } catch (err) {
                this.writeLines(`[red]Expression error in arg: ${err.message}`);
                return { command: "", args: [], kwargs: {} };
            }

            i++;
        }

        return {
            command,
            args,
            kwargs
        };
    }

    tokenizeExpression(input) {
        const tokens = [];
        let i = 0;

        const readQuoted = (quoteChar) => {
            let value = quoteChar;
            i++;

            while (i < input.length) {
                const ch = input[i];
                value += ch;
                i++;

                if (ch === "\\" && i < input.length) {
                    value += input[i];
                    i++;
                    continue;
                }

                if (ch === quoteChar) {
                    break;
                }
            }

            return value;
        };

        while (i < input.length) {
            const ch = input[i];

            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            if (ch === '"' || ch === "'") {
                tokens.push(readQuoted(ch));
                continue;
            }

            if (ch === "&" && input[i + 1] === "&") {
                tokens.push("&&");
                i += 2;
                continue;
            }

            if (ch === "|" && input[i + 1] === "|") {
                tokens.push("||");
                i += 2;
                continue;
            }

            if ("+-*/()".includes(ch)) {
                tokens.push(ch);
                i++;
                continue;
            }

            let value = "";

            while (i < input.length) {
                const current = input[i];

                if (/\s/.test(current)) break;
                if (current === '"' || current === "'") break;
                if ("+-*/()".includes(current)) break;
                if (current === "&" && input[i + 1] === "&") break;
                if (current === "|" && input[i + 1] === "|") break;

                value += current;
                i++;
            }

            if (value) {
                tokens.push(value);
            } else {
                tokens.push(input[i]);
                i++;
            }
        }

        return tokens;
    }

    tokenizeCommand(input) {
        const tokens = [];
        let i = 0;

        const readQuoted = (quoteChar) => {
            let value = quoteChar;
            i++;

            while (i < input.length) {
                const ch = input[i];
                value += ch;
                i++;

                if (ch === "\\" && i < input.length) {
                    value += input[i];
                    i++;
                    continue;
                }

                if (ch === quoteChar) {
                    break;
                }
            }

            return value;
        };

        const readBraced = () => {
            let depth = 0;
            let value = "";

            while (i < input.length) {
                const ch = input[i];

                if (ch === '"' || ch === "'") {
                    value += readQuoted(ch);
                    continue;
                }

                value += ch;

                if (ch === "{") {
                    depth++;
                } else if (ch === "}") {
                    depth--;

                    if (depth === 0) {
                        i++;
                        break;
                    }
                }

                i++;
            }

            return value;
        };

        while (i < input.length) {
            const ch = input[i];

            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            if (ch === '"' || ch === "'") {
                tokens.push(readQuoted(ch));
                continue;
            }

            // Keep the whole {...} as one processed argument.
            if (ch === "{") {
                tokens.push(readBraced());
                continue;
            }

            // These still split globally.
            if (ch === "&" && input[i + 1] === "&") {
                tokens.push("&&");
                i += 2;
                continue;
            }

            if (ch === "|" && input[i + 1] === "|") {
                tokens.push("||");
                i += 2;
                continue;
            }

            // Only equals splits globally for kwargs.
            if (ch === "=") {
                tokens.push("=");
                i++;
                continue;
            }

            let value = "";

            while (i < input.length) {
                const current = input[i];

                if (/\s/.test(current)) break;
                if (current === '"' || current === "'") break;
                if (current === "{") break;
                if (current === "}") break;
                if (current === "=") break;

                if (current === "&" && input[i + 1] === "&") break;
                if (current === "|" && input[i + 1] === "|") break;

                // IMPORTANT:
                // Do NOT break on + - * / ( ) here.
                // Outside {...}, they are just normal argument characters.

                value += current;
                i++;
            }

            if (value) {
                tokens.push(value);
            } else {
                tokens.push(input[i]);
                i++;
            }
        }

        return tokens;
    }

    stripQuotes(value) {
        const wasQuoted = (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        );
        const stripped = wasQuoted ? value.slice(1, -1) : value;
        return { value: stripped, wasQuoted };
    }

    parseColorSegments(text) {
        const fragments = [];
        let currentColor = "";
        let buffer = "";
        let i = 0;

        while (i < text.length) {
            if (text[i] === "\\" && i + 1 < text.length) {
                const next = text[i + 1];

                if (next === "[" || next === "]" || next === "\\") {
                    buffer += next;
                    i += 2;
                    continue;
                }

                if (next === "n") {
                    buffer += "\n";
                    i += 2;
                    continue;
                }
            }

            if (text[i] === "[") {
                const end = text.indexOf("]", i + 1);

                if (end !== -1) {
                    const colorValue = text.slice(i + 1, end);

                    if (buffer.length) {
                        fragments.push({
                            text: buffer,
                            color: currentColor
                        });

                        buffer = "";
                    }

                    currentColor = colorValue || currentColor;
                    i = end + 1;
                    continue;
                }
            }

            buffer += text[i];
            i += 1;
        }

        if (buffer.length) {
            fragments.push({
                text: buffer,
                color: currentColor
            });
        }

        return fragments;
    }

    createOutputLine(line) {
        const wrapper = document.createElement("div");
        wrapper.className = "terminal-output-line";

        this.parseColorSegments(line).forEach((fragment) => {
            const parts = fragment.text.split("\n");

            parts.forEach((part, index) => {
                if (index > 0) {
                    wrapper.appendChild(document.createElement("br"));
                }

                if (part.length) {
                    const span = document.createElement("span");
                    span.textContent = part;

                    if (fragment.color) {
                        span.style.color = fragment.color;
                    }

                    wrapper.appendChild(span);
                }
            });
        });

        return wrapper;
    }

    writeLines(lines) {
        if (!Array.isArray(lines)) {
            lines = [lines];
        }

        const inputRow = document.querySelector("#terminal-content .terminal-row");

        if (!inputRow) {
            return;
        }

        lines.forEach((line) => {
            const lineElement = this.createOutputLine(String(line));
            terminalContent.insertBefore(lineElement, inputRow);
        });

        terminalContent.scrollTop = terminalContent.scrollHeight;
        cmdText.focus();
    }
}

class CorePackage {
    static packageInfo = {
        "name": "default",
        "version": "1.0.2"
    };

    static commands = {
        help: ["help", -1],
        clear: ["clear", 0],
        cls: ["clear", 0],
        log: ["log", 1],
        packages: ["packages", 0],
        commands: ["listCommands", 0],
        version: ["getVer", 1],

        newvar: ["newvar", 1],
        setvar: ["setvar", 2],
        delvar: ["delvar", 1],
        vars: ["listvars", 0]
    };

    constructor(terminal) {
        this.terminal = terminal;
    }

    help(ctx) {
        return [
            "[#ffff92]Available internal commands:",
            "\n/ ----- Core ----- /\n\n",
            "[white]help - [gray]Help command, lists default commands with explanations",
            "[white]clear / cls - [gray]Clear all content in terminal",
            "[white]log {text} - [gray]Logs text to terminal",
            "[white]packages - [gray]List all currently installed packages",
            "[white]commands - [gray]List all current available internal and external commands.",
            "[white]version {package} - [gray]Writes version of selected package",
            "\n / ----- Variables ----- /\n\n",
            "[white]newvar {varname} - [gray]Defines a new variable in memory. Note: spaces are automatically replaced with '_'.",
            "[white]setvar {varname, value} - [gray]Sets the value of a variable. Type is the type, such as int, str or other.",
            "[white]delvar {varname} - [gray]Deletes a variable from memory. Variable must exist. Use 'delvar all' to clear all variables.",
            "[white]vars - [gray]Lists all existing variables."
        ];
    }

    clear(ctx) {
        const inputRow = document.querySelector("#terminal-content .terminal-row");

        document
            .querySelectorAll("#terminal-content .terminal-output-line")
            .forEach(el => el.remove());

        if (inputRow) {
            terminalContent.appendChild(inputRow);
        }

        cmdText.focus();
        return "";
    }

    log(ctx) {
        return ctx.args[0]
    }

    packages(ctx) {
        return [...ctx.terminal.packages.keys()]
            .map(name => `[yellow]${name}`);
    }

    listCommands(ctx) {
        const groups = new Map();

        for (const [commandName, commandInfo] of ctx.terminal.commands.entries()) {
            const packageName = commandInfo.packageName || "default";

            if (!groups.has(packageName)) {
                groups.set(packageName, []);
            }

            groups.get(packageName).push(commandName);
        }

        const lines = [];

        for (const [packageName, commands] of groups.entries()) {
            if (packageName === "default") {
                lines.push("[#0f0]default commands\n\n");
            } else {
                lines.push(`\n[cyan]'${packageName}' package\n\n`);
            }

            commands.forEach(command => {
                lines.push(`[yellow]${command}`);
            });

            lines.push("");
        }

        return lines;
    }
    getVer(ctx) {
        const packageName = ctx.args[0];

        if (!packageName) {
            return "[red]Usage: version {package}";
        }

        const packageInstance = ctx.terminal.packages.get(packageName);

        if (!packageInstance) {
            return `[red]No package named ${packageName} found.`;
        }

        const info = packageInstance.packageInfo || packageInstance.constructor.packageInfo;

        if (!info) {
            return `[red]Package ${packageName} has no packageInfo.`;
        }

        return `[yellow]${info.name} [white]is version [yellow]${info.version || "unknown"}`;
    }
    newvar(ctx) {
        const normalized = ctx.args[0].replace(" ", "_");

        if (normalized in ctx.terminal.variables) {
            return `[red]Variable named '${normalized}' already exists.`;
        }

        ctx.terminal.variables[normalized] = "";
        return `[#0f0]Variable '${normalized}' created.`;
    }
    setvar(ctx) {
        if (!(ctx.args[0] in ctx.terminal.variables)) return `[red]'${ctx.args[0]}' does not exist. Use newvar to create it.`;

        ctx.terminal.variables[ctx.args[0]] = ctx.args[1];
        return `[#0f0]Variable '${ctx.args[0]}' assigned to value '${ctx.args[1]}'`;
    }
    delvar(ctx) {
        if (!ctx.args[0] in ctx.terminal.variables) return `'${ctx.args[0]}' does not exist. Use newvar to create it.`;
        if (ctx.args[0] === "all") {
            ctx.terminal.variables = {};
            return `[#0f0]All variables deleted.`;
        }

        delete ctx.terminal.variables[ctx.args[0]];
        return `[#0f0]Variable '${ctx.args[0]}' deleted.`;
    }
    listvars(ctx) {
        const vars = ctx.terminal.variables;

        if (!vars || typeof vars !== "object" || Array.isArray(vars)) {
            return "[red]No valid variables object exists on terminal.";
        }

        const entries = Object.entries(vars);

        if (entries.length === 0) {
            return "[gray]No variables set.";
        }

        return entries.map(([name, value]) => {
            return `[#0066ff]${name}: [white]${String(value).length > 0 ? String(value) : "[gray]null"}`;
        });
    }
}

class SettingsPackage {
    static packageInfo = {
        "name": "general_settings",
        "version": "1.0.0",
    }

    static commands = {
        set: ["set", -1]
    };

    constructor(terminal) {
        this.terminal = terminal;
    }

    set(ctx) {
        const setting = ctx.args[0];

        if (setting === "clone-limit") {
            if (ctx.args.length !== 2) {
                return `[red]'set clone-limit' expected 2 args, got ${ctx.args.length} instead.`
            }
            const value = Number(ctx.args[1]);

            if (!Number.isFinite(value)) {
                return "[red]Usage: set clone-limit value=500";
            }
            if (value > 2000 && window.location.hostname === "scratch.mit.edu") {
                return "[red]Max clones 2000 on Scratch for lag reasons"
            }

            const input = document.getElementById("clonelimit");

            if (input) {
                input.value = value;
            }

            return `[white]Clone limit set to [yellow]${value}`;
        }

        return `[red]Unknown setting: ${setting}`;
    }
}

class VmPackage {
    // first get the base client.js thing

    static packageInfo = {
        "name": "vm",
        "version": "1.0.0",
    }
    static commands = {
        "setvar": ["setVmVar", 3],
        "setusername": ["setVmUser", 1],
        "username": ["getVmUser", 0]
    }

    setVmVar(ctx) {
        window.mint_base_client.setVar(ctx.args[0], ctx.args[1], ctx.args[2]);
        return `[white] Variable '[yellow]${ctx.args[0]}[white]' of target [yellow]#${ctx.args[2]}[white] set to '[yellow]${ctx.args[1]}[white]'`;
    }
    setVmUser(ctx) {
        window.mint_base_client.setUsername(ctx.args[0]);
        return `[white] Username set to '[yellow]${ctx.args[0]}[white]'`;
    }
    getVmUser(ctx) {
        user = window.mint_base_client.getUsername();

        if (!user || user.length === 0) {
            return '[red] Failed to get username. Username is either unset or empty.';
        }

        return `[yellow]${user}`;
    }
}

window.MintTerminal = MintTerminal;

window.terminal = new MintTerminal();

terminal.installPackage(CorePackage);
terminal.installPackage(SettingsPackage);
terminal.installPackage(VmPackage)

terminal.writeLines(
    "[cyan]Mint | License: MIT | Version: 1.0.1\n" +
    "[#ffff92]Welcome to Mint Terminal (v1.0.1). Use 'help' for information on commands.\n\n"
);

function runCommand(command) {
    return terminal.executeCommand(command);
}