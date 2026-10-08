// Pocket Mods entry point for Minecraft Bedrock (Pocket Edition).
//
// Mods in this add-on:
//   1. Wind Charm    - right-click to launch yourself forward and up.
//   2. Thunder Wand  - right-click to call lightning on the block you aim at.
//   3. Mod Menu      - right-click (or type /menu) to open the window in menu.js.
//   4. /sethome, /home - save a home point and teleport back to it (home.js).
//
// Settings are in config.js. Only stable @minecraft/server and @minecraft/server-ui APIs are used.
import {
    CommandPermissionLevel,
    CustomCommandStatus,
    Player,
    system,
    world,
} from '@minecraft/server';
import { COMMANDS, MOD_MENU, THUNDER_WAND, WIND_CHARM } from './config.js';
import { goHome, saveHome } from './home.js';
import { openMenu } from './menu.js';

/**
 * @typedef {import('@minecraft/server').CustomCommandOrigin} CommandOrigin
 * @typedef {import('@minecraft/server').CustomCommandRegistry} CommandRegistry
 * @typedef {{ id: string, name: string, cooldownTicks: number }} CooldownItem
 */

// ---- Shared helpers ---------------------------------------------------------

// Cooldowns live in memory, keyed by player id and item id.
const lastUsedTick = new Map();

/**
 * @param {Player} player
 * @param {{ id: string }} item
 */
function cooldownKey(player, item) {
    return `${player.id}|${item.id}`;
}

// Returns true when the item can be used right now. If it is still recharging,
// shows the time left on the action bar and returns false.
/**
 * @param {Player} player
 * @param {CooldownItem} item
 */
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

/**
 * @param {Player} player
 * @param {{ id: string }} item
 */
function startCooldown(player, item) {
    lastUsedTick.set(cooldownKey(player, item), system.currentTick);
}

/**
 * @param {{ x: number, y: number, z: number }} a
 * @param {{ x: number, y: number, z: number }} b
 */
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

// Custom command callbacks come from the command system, not from a player.
/**
 * @param {CommandOrigin} origin
 * @returns {Player | undefined}
 */
function playerFromOrigin(origin) {
    const source = origin.initiator ?? origin.sourceEntity;
    return source instanceof Player ? source : undefined;
}

// ---- Mod 1: Wind Charm ------------------------------------------------------

/** @param {Player} player */
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

/** @param {Player} player */
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
        case MOD_MENU.id:
            system.run(() => openMenu(player));
            break;
    }
});

// Registers a slash command that only players can use. The work runs on the next tick,
// because custom command callbacks are read-only.
/**
 * @param {CommandRegistry} registry
 * @param {string} name
 * @param {string} description
 * @param {(player: Player) => void} action
 */
function registerPlayerCommand(registry, name, description, action) {
    registry.registerCommand(
        {
            name,
            description,
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
        },
        (origin) => {
            const player = playerFromOrigin(origin);
            if (!player) {
                return { status: CustomCommandStatus.Failure, message: 'Only players can use this command.' };
            }
            system.run(() => action(player));
            return { status: CustomCommandStatus.Success };
        },
    );
}

system.beforeEvents.startup.subscribe((event) => {
    const registry = event.customCommandRegistry;
    registerPlayerCommand(registry, COMMANDS.sethome, 'Save your current position as your home.', saveHome);
    registerPlayerCommand(registry, COMMANDS.home, 'Teleport to your saved home.', goHome);
    registerPlayerCommand(registry, COMMANDS.menu, 'Open the Pocket Mods window.', openMenu);
});
