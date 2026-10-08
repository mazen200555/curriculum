// A small stand-in for the stable @minecraft/server 2.x module, used only by the tests.
// It implements the parts of the API that Pocket Mods uses and records what the add-on
// does, so the tests can check it. It is not Minecraft, and it does not check everything
// the real game checks. Only the stable API names used by the add-on are included.

export const GameMode = {
    Adventure: 'Adventure',
    Creative: 'Creative',
    Spectator: 'Spectator',
    Survival: 'Survival',
};

export const Difficulty = {
    Easy: 'Easy',
    Hard: 'Hard',
    Normal: 'Normal',
    Peaceful: 'Peaceful',
};

export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2, Custom: 3 };
export const CommandPermissionLevel = { Any: 0 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };

const state = {
    tick: 0,
    queue: [],
    itemUseHandlers: [],
    startupHandlers: [],
    commands: new Map(),
    difficulty: Difficulty.Normal,
    dimensions: {},
};

class Dimension {
    constructor(name) {
        this.id = `minecraft:${name}`;
        this.spawned = [];
        this.sounds = [];
    }

    spawnEntity(identifier, location) {
        this.spawned.push({ identifier, location: { ...location } });
        return { typeId: identifier };
    }

    playSound(soundId, location) {
        this.sounds.push({ soundId, location: location ? { ...location } : undefined });
    }
}

for (const name of ['overworld', 'nether', 'the_end']) {
    state.dimensions[name] = new Dimension(name);
}

export class ItemStack {
    constructor(typeId, amount = 1) {
        this.typeId = typeId;
        this.amount = amount;
    }
}

export class Player {
    constructor({
        name,
        operator = false,
        gameMode = GameMode.Survival,
        dimension = 'overworld',
        location = { x: 0, y: 64, z: 0 },
    }) {
        this.id = name;
        this.name = name;
        this.playerPermissionLevel = operator
            ? PlayerPermissionLevel.Operator
            : PlayerPermissionLevel.Member;
        this.dimension = state.dimensions[dimension];
        this.location = { ...location };
        this.look = { x: 0, y: 0, z: 1 }; // a unit vector, like the real game
        this.hit = undefined; // set by a test to the block the player is aiming at
        this.lastRaycast = undefined;
        this.gameMode = gameMode;
        this.properties = new Map();
        this.messages = [];
        this.actionBars = [];
        this.sounds = [];
        this.effects = [];
        this.knockbacks = [];
        this.teleports = [];
        this.inventory = [];
        this.inventoryCapacity = 36;
        this.onScreenDisplay = {
            setActionBar: (text) => {
                this.actionBars.push(text);
            },
        };
    }

    getViewDirection() {
        return { ...this.look };
    }

    applyKnockback(horizontalForce, verticalStrength) {
        this.knockbacks.push({ horizontalForce: { ...horizontalForce }, verticalStrength });
    }

    addEffect(effectType, duration, options) {
        this.effects.push({ effectType, duration, options });
    }

    playSound(soundId) {
        this.sounds.push(soundId);
    }

    getBlockFromViewDirection(options) {
        this.lastRaycast = options;
        if (!this.hit) {
            return undefined;
        }
        return { block: { location: { ...this.hit } } };
    }

    getDynamicProperty(key) {
        return this.properties.get(key);
    }

    setDynamicProperty(key, value) {
        this.properties.set(key, value);
    }

    sendMessage(message) {
        this.messages.push(message);
    }

    teleport(location, options = {}) {
        this.location = { ...location };
        if (options.dimension) {
            this.dimension = options.dimension;
        }
        this.teleports.push({ location: { ...location }, dimension: this.dimension.id });
    }

    getGameMode() {
        return this.gameMode;
    }

    setGameMode(gameMode) {
        this.gameMode = gameMode;
    }

    getComponent(componentId) {
        if (componentId !== 'inventory') {
            return undefined;
        }
        const player = this;
        return {
            container: {
                addItem(itemStack) {
                    if (player.inventory.length >= player.inventoryCapacity) {
                        return itemStack; // full: hand the item back, like the real API
                    }
                    player.inventory.push({ typeId: itemStack.typeId, amount: itemStack.amount });
                    return undefined;
                },
            },
        };
    }
}

export const world = {
    afterEvents: {
        itemUse: {
            subscribe(handler) {
                state.itemUseHandlers.push(handler);
                return handler;
            },
        },
    },
    getDimension(name) {
        const dimension = state.dimensions[name];
        if (!dimension) {
            throw new Error(`Unknown dimension: ${name}`);
        }
        return dimension;
    },
    getDifficulty() {
        return state.difficulty;
    },
    setDifficulty(difficulty) {
        state.difficulty = difficulty;
    },
};

export const system = {
    get currentTick() {
        return state.tick;
    },
    run(callback) {
        state.queue.push(callback);
        return state.queue.length;
    },
    beforeEvents: {
        startup: {
            subscribe(handler) {
                state.startupHandlers.push(handler);
                return handler;
            },
        },
    },
};

// Test controls. The add-on never uses these.
export const __mock = {
    dimension(name) {
        return state.dimensions[name];
    },
    advance(ticks) {
        state.tick += ticks;
    },
    // Runs the work the add-on queued with system.run, including work queued while running.
    flush() {
        while (state.queue.length > 0) {
            const callback = state.queue.shift();
            callback();
        }
    },
    fireItemUse(player, typeId) {
        const itemStack = typeId === undefined ? undefined : new ItemStack(typeId, 1);
        for (const handler of state.itemUseHandlers) {
            handler({ source: player, itemStack });
        }
    },
    runStartup() {
        const registry = {
            registerCommand(definition, callback) {
                state.commands.set(definition.name, { definition, callback });
            },
        };
        for (const handler of state.startupHandlers) {
            handler({ customCommandRegistry: registry });
        }
    },
    runCommand(name, origin) {
        const entry = state.commands.get(name);
        if (!entry) {
            throw new Error(`No command named ${name}`);
        }
        return entry.callback(origin);
    },
    registeredCommands() {
        return [...state.commands.keys()].sort();
    },
    reset() {
        state.difficulty = Difficulty.Normal;
        state.queue.length = 0;
        for (const dimension of Object.values(state.dimensions)) {
            dimension.spawned.length = 0;
            dimension.sounds.length = 0;
        }
    },
};
