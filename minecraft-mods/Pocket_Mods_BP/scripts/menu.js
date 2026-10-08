// The Mod Menu window. It opens from the Mod Menu item or from /menu.
import {
    Difficulty,
    GameMode,
    ItemStack,
    PlayerPermissionLevel,
    system,
    world,
} from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { ADMIN_OPTIONS_NEED_OPERATOR, MOD_MENU, THUNDER_WAND, WIND_CHARM } from './config.js';
import { describeHome, goHome, readHome, saveHome } from './home.js';

/**
 * @typedef {import('@minecraft/server').Player} Player
 * @typedef {import('@minecraft/server-ui').ActionFormData} Form
 */

// Classic modes: the four Minecraft game modes.
const GAME_MODES = [
    { value: GameMode.Survival, label: 'Survival' },
    { value: GameMode.Creative, label: 'Creative' },
    { value: GameMode.Adventure, label: 'Adventure' },
    { value: GameMode.Spectator, label: 'Spectator' },
];

// Classic modes: the four world difficulties.
const DIFFICULTIES = [
    { value: Difficulty.Peaceful, label: 'Peaceful' },
    { value: Difficulty.Easy, label: 'Easy' },
    { value: Difficulty.Normal, label: 'Normal' },
    { value: Difficulty.Hard, label: 'Hard' },
];

// Items the window can hand out. The icons are this add-on's own textures.
const GIVABLE_ITEMS = [
    { id: WIND_CHARM.id, label: WIND_CHARM.name, icon: 'textures/items/wind_charm' },
    { id: THUNDER_WAND.id, label: THUNDER_WAND.name, icon: 'textures/items/thunder_wand' },
    { id: MOD_MENU.id, label: MOD_MENU.name, icon: 'textures/items/mod_menu' },
];

/** @param {Player} player */
export function openMenu(player) {
    showMain(player);
}

/** @param {Player} player */
function isOperator(player) {
    return player.playerPermissionLevel === PlayerPermissionLevel.Operator;
}

// Operators can use the admin options. Everyone can, if ADMIN_OPTIONS_NEED_OPERATOR is false.
/** @param {Player} player */
function canUseAdminOptions(player) {
    return !ADMIN_OPTIONS_NEED_OPERATOR || isOperator(player);
}

/** @param {Player} player */
function refuseAdmin(player) {
    player.sendMessage('Only operators can use that option.');
}

// The label shown for a game mode or difficulty value.
/**
 * @param {{ value: unknown, label: string }[]} options
 * @param {unknown} value
 * @returns {string}
 */
function labelFor(options, value) {
    return options.find((option) => option.value === value)?.label ?? String(value);
}

// Shows a form. Passes the button the player chose to onPick. Closing the form does nothing.
// onPick runs through system.run, which is needed for changes to the world.
/**
 * @param {Player} player
 * @param {Form} form
 * @param {(selection: number) => void} onPick
 */
function showForm(player, form, onPick) {
    form.show(player).then((response) => {
        if (response.canceled || response.selection === undefined) {
            return;
        }
        const selection = response.selection;
        system.run(() => onPick(selection));
    }).catch(() => {
        // The form could not be shown, for example because the player was busy. Nothing to do.
    });
}

/** @param {Player} player */
function showMain(player) {
    const home = readHome(player);
    const admin = canUseAdminOptions(player);

    const actions = [
        { label: 'Set Home', run: () => saveHome(player) },
        { label: 'Go Home', run: () => goHome(player) },
        { label: 'Mod Guide', run: () => showGuide(player) },
    ];
    if (admin) {
        actions.push(
            { label: 'Game Mode', run: () => showGameModes(player) },
            { label: 'Difficulty', run: () => showDifficulties(player) },
            { label: 'Get Mod Items', run: () => showItems(player) },
        );
    }

    const lines = [`Home: ${home ? describeHome(home) : 'not set'}`];
    if (!admin) {
        lines.push('Game mode, difficulty, and item options are for operators.');
    }

    const form = new ActionFormData().title('Pocket Mods').body(lines.join('\n'));
    for (const action of actions) {
        form.button(action.label);
    }
    showForm(player, form, (selection) => actions[selection]?.run());
}

function guideText() {
    const operatorNote = ADMIN_OPTIONS_NEED_OPERATOR ? ' Operators only.' : '';
    return [
        `${WIND_CHARM.name}: right-click to launch forward and up. You float down slowly afterwards.`,
        `${THUNDER_WAND.name}: right-click to call lightning on the block you are looking at, up to ${THUNDER_WAND.range} blocks away.`,
        `${MOD_MENU.name}: right-click to open this window, or type /menu.`,
        'Set Home and Go Home: save a spot and come back to it, even from another dimension. Same as /sethome and /home.',
        `Game Mode, Difficulty, and Get Mod Items: change your mode, the world difficulty, or add Pocket Mods items.${operatorNote}`,
    ].join('\n\n');
}

/** @param {Player} player */
function showGuide(player) {
    const form = new ActionFormData().title('Mod Guide').body(guideText()).button('Back');
    showForm(player, form, () => showMain(player));
}

/** @param {Player} player */
function showGameModes(player) {
    const current = player.getGameMode();
    const form = new ActionFormData()
        .title('Game Mode')
        .body(`Your mode: ${labelFor(GAME_MODES, current)}. This changes only your mode.`);
    for (const option of GAME_MODES) {
        form.button(option.value === current ? `${option.label} (current)` : option.label);
    }
    form.button('Back');

    showForm(player, form, (selection) => {
        if (selection === GAME_MODES.length) {
            showMain(player);
            return;
        }
        const option = GAME_MODES[selection];
        if (!option) {
            return;
        }
        if (!canUseAdminOptions(player)) {
            refuseAdmin(player);
            return;
        }
        player.setGameMode(option.value);
        player.sendMessage(`Game mode set to ${option.label}.`);
    });
}

/** @param {Player} player */
function showDifficulties(player) {
    const current = world.getDifficulty();
    const form = new ActionFormData()
        .title('Difficulty')
        .body(`Current difficulty: ${labelFor(DIFFICULTIES, current)}. This changes the whole world.`);
    for (const option of DIFFICULTIES) {
        form.button(option.value === current ? `${option.label} (current)` : option.label);
    }
    form.button('Back');

    showForm(player, form, (selection) => {
        if (selection === DIFFICULTIES.length) {
            showMain(player);
            return;
        }
        const option = DIFFICULTIES[selection];
        if (!option) {
            return;
        }
        if (!canUseAdminOptions(player)) {
            refuseAdmin(player);
            return;
        }
        world.setDifficulty(option.value);
        player.sendMessage(`Difficulty set to ${option.label} for this world.`);
    });
}

/** @param {Player} player */
function showItems(player) {
    const form = new ActionFormData()
        .title('Get Mod Items')
        .body('Pick an item to add to your inventory.');
    for (const item of GIVABLE_ITEMS) {
        form.button(item.label, item.icon);
    }
    form.button('Back');

    showForm(player, form, (selection) => {
        if (selection === GIVABLE_ITEMS.length) {
            showMain(player);
            return;
        }
        const item = GIVABLE_ITEMS[selection];
        if (!item) {
            return;
        }
        if (!canUseAdminOptions(player)) {
            refuseAdmin(player);
            return;
        }
        giveItem(player, item);
    });
}

/**
 * @param {Player} player
 * @param {{ id: string, label: string }} item
 */
function giveItem(player, item) {
    const container = player.getComponent('inventory')?.container;
    if (!container) {
        player.sendMessage('Could not reach your inventory.');
        return;
    }
    const leftover = container.addItem(new ItemStack(item.id, 1));
    player.sendMessage(
        leftover ? 'Your inventory is full.' : `Added ${item.label} to your inventory.`,
    );
}
