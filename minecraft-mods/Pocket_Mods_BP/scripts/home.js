// Home logic, shared by the /sethome and /home commands and by the Mod Menu window.
import { world } from '@minecraft/server';
import { HOME_PROPERTY } from './config.js';

/**
 * @typedef {import('@minecraft/server').Player} Player
 * @typedef {import('@minecraft/server').Dimension} Dimension
 * @typedef {{ x: number, y: number, z: number, dimension: string }} Home
 */

// Rounds to one decimal place so the saved numbers stay short.
/** @param {number} value */
function round1(value) {
    return Math.round(value * 10) / 10;
}

// "minecraft:overworld" -> "overworld", the name world.getDimension() expects.
/** @param {Dimension} dimension */
function dimensionName(dimension) {
    return dimension.id.replace('minecraft:', '');
}

// Returns the saved home, or undefined if none is saved or the saved data is damaged.
/**
 * @param {Player} player
 * @returns {Home | undefined}
 */
export function readHome(player) {
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

// Saves the player's current position and dimension as their home.
/** @param {Player} player */
export function saveHome(player) {
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

// Teleports the player to their saved home, in whichever dimension it was saved.
/** @param {Player} player */
export function goHome(player) {
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

// Short text such as "12, 64, -5 (overworld)" for the Mod Menu.
/** @param {Home} home */
export function describeHome(home) {
    return `${home.x}, ${home.y}, ${home.z} (${home.dimension})`;
}
