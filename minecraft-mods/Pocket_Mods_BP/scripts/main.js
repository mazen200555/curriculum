// Pocket Mods: script logic for Minecraft Bedrock (Pocket Edition) add-ons.
//
// Only stable @minecraft/server APIs are used (manifest dependency 2.1.0),
// so the "Beta APIs" experiment does not need to be turned on.
//
// Mods in this file:
//   1. Wind Charm   - right-click to launch yourself forward and up.
//   2. Thunder Wand - right-click to call lightning on the block you aim at.
//   3. /sethome and /home - save a home point and teleport back to it.

import {
    CommandPermissionLevel,
    CustomCommandStatus,
    Player,
    system,
    world,
} from '@minecraft/server';

// ---- Settings (edit, then run build.py to rebuild the add-on) --------------
// 20 ticks = 1 second.

const WIND_CHARM = {
    id: 'pocketmods:wind_charm',
    name: 'Wind Charm',
    cooldownTicks: 80,     // 4 seconds between uses
    forwardStrength: 1.4,  // push in the direction you are looking
    upStrength: 1.0,       // push upward
    slowFallTicks: 100,    // 5 seconds of slow falling so the landing is soft
};

const THUNDER_WAND = {
    id: 'pocketmods:thunder_wand',
    name: 'Thunder Wand',
    cooldownTicks: 60,     // 3 seconds between strikes
    range: 60,             // how far away (in blocks) you can target
    minDistance: 4,        // closer than this and the strike could hit you
};

const HOME_PROPERTY = 'pocketmods_home';

// ---- Shared helpers ---------------------------------------------------------

// Cooldowns live in memory, keyed by player id and item id.
const lastUsedTick = new Map();

function cooldownKey(player, item) {
    return `${player.id}|${item.id}`;
}

// Returns true when the item can be used right now. If it is still recharging,
// shows the time left on the action bar and returns false.
function canUse(player, item) {
    const last = lastUsedTick.get(cooldownKey(player, item));
    if (last === undefined) {
        return true;
    }

    const now = system.currentTick;
    if (last === now) {
        return false; // the same use reported twice in one tick
    }

    const remaining = last + item.cooldownTicks - now;
    if (remaining > 0) {
        const seconds = (remaining / 20).toFixed(1);
        player.onScreenDisplay.setActionBar(`${item.name} recharging: ${seconds}s`);
        return false;
    }
    return true;
}

function startCooldown(player, item) {
    lastUsedTick.set(cooldownKey(player, item), system.currentTick);
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function round1(value) {
    return Math.round(value * 10) / 10;
}

// "minecraft:overworld" -> "overworld", the name world.getDimension() expects.
function dimensionName(dimension) {
    return dimension.id.replace('minecraft:', '');
}

// ---- Mod 1: Wind Charm ------------------------------------------------------

function useWindCharm(player) {
    if (!canUse(player, WIND_CHARM)) {
        return;
    }
    startCooldown(player, WIND_CHARM);

    // getViewDirection() returns a unit vector. Its horizontal part is the
    // direction of the forward push. It is zero when looking straight up or down.
    const look = player.getViewDirection();
    const flat = Math.hypot(look.x, look.z);
    const dirX = flat > 0 ? look.x / flat : 0;
    const dirZ = flat > 0 ? look.z / flat : 0;

    player.applyKnockback(
        { x: dirX * WIND_CHARM.forwardStrength, z: dirZ * WIND_CHARM.forwardStrength },
        WIND_CHARM.upStrength,
    );
    player.addEffect('slow_falling', WIND_CHARM.slowFallTicks, {
        amplifier: 0,
        showParticles: false,
    });
    player.playSound('item.trident.riptide_1');
}

// ---- Mod 2: Thunder Wand ----------------------------------------------------

function useThunderWand(player) {
    if (!canUse(player, THUNDER_WAND)) {
        return;
    }

    const hit = player.getBlockFromViewDirection({ maxDistance: THUNDER_WAND.range });
    if (!hit) {
        player.onScreenDisplay.setActionBar('No block in range to strike.');
        return;
    }

    // Strike the top of the block being looked at.
    const spot = hit.block.location;
    const target = { x: spot.x + 0.5, y: spot.y + 1, z: spot.z + 0.5 };
    if (distance(player.location, target) < THUNDER_WAND.minDistance) {
        player.onScreenDisplay.setActionBar('Too close to strike!');
        return;
    }

    startCooldown(player, THUNDER_WAND);
    player.dimension.spawnEntity('minecraft:lightning_bolt', target);
    player.dimension.playSound('ambient.weather.thunder', target);
}

// ---- Mod 3: /sethome and /home ----------------------------------------------
// Custom command callbacks run in read-only mode, so the work that changes
// anything (saving, teleporting, messages) is queued with system.run().

function playerFromOrigin(origin) {
    const source = origin.initiator ?? origin.sourceEntity;
    return source instanceof Player ? source : undefined;
}

// Returns the saved home, or undefined if none is saved or the data is damaged.
function readHome(player) {
    const raw = player.getDynamicProperty(HOME_PROPERTY);
    if (typeof raw !== 'string') {
        return undefined;
    }
    try {
        const home = JSON.parse(raw);
        const hasCoords = [home.x, home.y, home.z].every(
            (n) => typeof n === 'number' && Number.isFinite(n),
        );
        return hasCoords && typeof home.dimension === 'string' ? home : undefined;
    } catch (error) {
        return undefined;
    }
}

function saveHome(player) {
    const { x, y, z } = player.location;
    const home = {
        x: round1(x),
        y: round1(y),
        z: round1(z),
        dimension: dimensionName(player.dimension),
    };
    player.setDynamicProperty(HOME_PROPERTY, JSON.stringify(home));
    player.sendMessage(`Home saved at ${home.x}, ${home.y}, ${home.z} (${home.dimension}).`);
}

function goHome(player) {
    const home = readHome(player);
    if (!home) {
        player.sendMessage('You have no home yet. Stand somewhere and type /sethome.');
        return;
    }
    try {
        const dimension = world.getDimension(home.dimension);
        player.teleport({ x: home.x, y: home.y, z: home.z }, { dimension });
        player.sendMessage('Welcome home!');
    } catch (error) {
        player.sendMessage('Could not teleport you home. Save your home again with /sethome.');
    }
}

// ---- Registration -----------------------------------------------------------

// Right-click (use) with one of the custom items.
world.afterEvents.itemUse.subscribe((event) => {
    const player = event.source;
    if (!(player instanceof Player)) {
        return;
    }

    switch (event.itemStack?.typeId) {
        case WIND_CHARM.id:
            useWindCharm(player);
            break;
        case THUNDER_WAND.id:
            useThunderWand(player);
            break;
    }
});

// Slash commands. Minecraft also accepts the plain names (/sethome and /home).
system.beforeEvents.startup.subscribe((event) => {
    const registry = event.customCommandRegistry;

    registry.registerCommand(
        {
            name: 'pocketmods:sethome',
            description: 'Save your current position as your home.',
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
        },
        (origin) => {
            const player = playerFromOrigin(origin);
            if (!player) {
                return { status: CustomCommandStatus.Failure, message: 'Only players can use this command.' };
            }
            system.run(() => saveHome(player));
            return { status: CustomCommandStatus.Success };
        },
    );

    registry.registerCommand(
        {
            name: 'pocketmods:home',
            description: 'Teleport to your saved home.',
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
        },
        (origin) => {
            const player = playerFromOrigin(origin);
            if (!player) {
                return { status: CustomCommandStatus.Failure, message: 'Only players can use this command.' };
            }
            system.run(() => goHome(player));
            return { status: CustomCommandStatus.Success };
        },
    );
});
