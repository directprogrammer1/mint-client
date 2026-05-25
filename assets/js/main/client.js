const mintLog = (content, type = "log") => {
    if (typeof globalThis.log === "function") {
        globalThis.log(content, type);
    }
};

// DEFAULT CLIENT (set variables & other)

class MintClient {
    constructor() {
        this.vm = null;
        this.cloneLimit = 300;
    }

    init(vm) {
        this.vm = vm;

        const speedVar = this.getVariable("Speed");
        if (speedVar) {
            this.player.multipliers.defaultSpeed = Number(speedVar.value) || 50;
        }

        mintLog("VM assigned", "info");
    }

    requireVM() {
        if (!this.vm) {
            mintLog(
                "A scratch/turbowarp VM is required for this operation. Call client.init(vm) first.",
                "warn"
            );
            return false;
        }
        return true;
    }

    getTarget(targetIndex = 0) {
        if (!this.requireVM()) return null;
        return this.vm.runtime.targets[targetIndex] || null;
    }

    getVariable(name, targetIndex = 0) {
        if (!this.requireVM()) return null;

        const targetObj = typeof targetIndex === "number"
            ? this.getTarget(targetIndex)
            : targetIndex;

        if (!targetObj) {
            mintLog(`Target ${targetIndex} not found.`, "warn");
            return null;
        }

        const vars = targetObj.variables || {};

        for (const variable of Object.values(vars)) {
            if (variable.name === name) {
                return variable;
            }
        }

        mintLog(`Variable with name ${name} not found.`, "warn");
        return null;
    }

    setVar(name, value, targetIndex = 0) {
        if (!this.requireVM()) return;

        const targetObj = this.getTarget(targetIndex);
        if (!targetObj) {
            mintLog(`Target ${targetIndex} not found.`, "warn");
            return;
        }

        const variable = this.getVariable(name, targetObj);

        if (variable) {
            variable.value = value;
            mintLog(`Variable ${variable.name} set to: ${value}`, "info");
        } else {
            mintLog(`Variable with name ${name} not found on target ${targetIndex}.`, "warn");
        }
    }

    setUsername(username) {
        if (!this.requireVM()) return;
        this.vm.runtime.ioDevices.userData._username = username;
        mintLog(`Username set to: ${username}`, "info");
    }

    getUsername() {
        if (!this.requireVM()) return null;
        return this.vm.runtime.ioDevices.userData._username;
    }

    setCloneLimit(count = 300) {
        if (!this.requireVM()) return null;
        this.vm.runtime.clonesAvailable = function () {
            return this._cloneCounter < count;
        };
        this.cloneLimit = count;
        mintLog(`Clone limit set to: ${count}`, "info");
    }
}

window.mint_base_client = new MintClient();