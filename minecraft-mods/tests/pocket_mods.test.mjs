// Behavior tests for the Pocket Mods add-on.
//
// The tests copy the add-on's scripts next to small stand-ins for the Minecraft script
// modules (tests/fake_modules), then run them the way the game does: item use events fire,
// slash commands run, and forms get answered. They cannot show how the game looks or feels.
// See the Status section of README.md for what still needs checking in the game.
//
// Run from the minecraft-mods folder with:
//   node --test tests/pocket_mods.test.mjs
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const addonScripts = join(here, '..', 'Pocket_Mods_BP', 'scripts');
const fakeModules = join(here, 'fake_modules', '@minecraft');

const root = mkdtempSync(join(tmpdir(), 'pocket-mods-test-'));
after(() => rmSync(root, { recursive: true, force: true }));
cpSync(addonScripts, join(root, 'scripts'), { recursive: true });
cpSync(fakeModules, join(root, 'node_modules', '@minecraft'), { recursive: true });
writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));

const fileUrl = (...parts) => pathToFileURL(join(root, ...parts)).href;
const server = await import(fileUrl('node_modules', '@minecraft', 'server', 'index.js'));
const ui = await import(fileUrl('node_modules', '@minecraft', 'server-ui', 'index.js'));
await import(fileUrl('scripts', 'main.js')); // starts the add-on, as the game does
server.__mock.runStartup();

const { CustomCommandStatus, Difficulty, GameMode, PlayerPermissionLevel, world } = server;
const mock = server.__mock;

beforeEach(() => mock.reset());

let playerCount = 0;
function makePlayer(options = {}) {
    playerCount += 1;
    return new server.Player({ name: `tester${playerCount}`, ...options });
}

// Lets the add-on's queued work run, including any forms that work opens.
async function settle() {
    for (let i = 0; i < 4; i++) {
        await new Promise((resolve) => setImmediate(resolve));
        mock.flush();
    }
}

// The newest form shown to this player that has not been answered yet.
function openForm(player) {
    const open = ui.__mock.forms.filter((entry) => entry.player === player && !entry.answered);
    return open.at(-1);
}

function formButtons(entry) {
    return entry.form.buttons.map((button) => button.text);
}

// Presses button `index` on the player's open form, as a tap would.
async function press(player, index) {
    const entry = openForm(player);
    assert.ok(entry, 'expected an open form');
    entry.answered = true;
    entry.resolve({ canceled: false, selection: index });
    await settle();
}

// Closes the player's open form without choosing anything.
async function closeForm(player) {
    const entry = openForm(player);
    assert.ok(entry, 'expected an open form');
    entry.answered = true;
    entry.resolve({ canceled: true, selection: undefined, cancelationReason: 'UserClosed' });
    await settle();
}

describe('registration', () => {
    it('registers /sethome, /home and /menu as custom commands', () => {
        assert.deepEqual(mock.registeredCommands(), [
            'pocketmods:home',
            'pocketmods:menu',
            'pocketmods:sethome',
        ]);
    });
});

describe('Wind Charm', () => {
    it('launches forward and up, then applies slow falling and plays the riptide sound', () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'pocketmods:wind_charm');

        assert.equal(player.knockbacks.length, 1);
        assert.deepEqual(player.knockbacks[0].horizontalForce, { x: 0, z: 1.4 });
        assert.equal(player.knockbacks[0].verticalStrength, 1.0);
        assert.deepEqual(player.effects, [
            { effectType: 'slow_falling', duration: 100, options: { amplifier: 0, showParticles: false } },
        ]);
        assert.deepEqual(player.sounds, ['item.trident.riptide_1']);
    });

    it('a second use within the 80-tick cooldown is refused with a message', () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'pocketmods:wind_charm');
        mock.advance(20);
        mock.fireItemUse(player, 'pocketmods:wind_charm');

        assert.equal(player.knockbacks.length, 1);
        assert.equal(player.actionBars.at(-1), 'Wind Charm recharging: 3.0s');
    });

    it('works again once the 80-tick cooldown has passed', () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'pocketmods:wind_charm');
        mock.advance(80);
        mock.fireItemUse(player, 'pocketmods:wind_charm');

        assert.equal(player.knockbacks.length, 2);
    });

    it('a duplicate use reported in the same tick is ignored', () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'pocketmods:wind_charm');
        mock.fireItemUse(player, 'pocketmods:wind_charm');

        assert.equal(player.knockbacks.length, 1);
        assert.deepEqual(player.actionBars, []);
    });

    it('looking straight up gives a purely vertical launch (no NaN)', () => {
        const player = makePlayer();
        player.look = { x: 0, y: 1, z: 0 };
        mock.fireItemUse(player, 'pocketmods:wind_charm');

        assert.deepEqual(player.knockbacks[0].horizontalForce, { x: 0, z: 0 });
        assert.equal(player.knockbacks[0].verticalStrength, 1.0);
    });

    it('other items and non-player sources do nothing', () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'minecraft:stick');
        mock.fireItemUse({ id: 'commandblock' }, 'pocketmods:wind_charm');

        assert.equal(player.knockbacks.length, 0);
        assert.equal(player.effects.length, 0);
    });
});

describe('Thunder Wand', () => {
    it('strikes the top of the block being aimed at, with a 60-block raycast', () => {
        const player = makePlayer();
        player.hit = { x: 10, y: 64, z: 10 };
        mock.fireItemUse(player, 'pocketmods:thunder_wand');

        const overworld = mock.dimension('overworld');
        assert.equal(player.lastRaycast.maxDistance, 60);
        assert.deepEqual(overworld.spawned, [
            { identifier: 'minecraft:lightning_bolt', location: { x: 10.5, y: 65, z: 10.5 } },
        ]);
        assert.deepEqual(overworld.sounds.map((sound) => sound.soundId), ['ambient.weather.thunder']);
    });

    it('a successful strike starts a 60-tick cooldown', () => {
        const player = makePlayer();
        player.hit = { x: 10, y: 64, z: 10 };
        mock.fireItemUse(player, 'pocketmods:thunder_wand');
        mock.advance(20);
        mock.fireItemUse(player, 'pocketmods:thunder_wand');

        assert.equal(mock.dimension('overworld').spawned.length, 1);
        assert.equal(player.actionBars.at(-1), 'Thunder Wand recharging: 2.0s');
    });

    it('pointing at nothing shows a message and does not start a cooldown', () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'pocketmods:thunder_wand');

        assert.equal(player.actionBars.at(-1), 'No block in range to strike.');
        assert.equal(mock.dimension('overworld').spawned.length, 0);

        player.hit = { x: 10, y: 64, z: 10 };
        mock.fireItemUse(player, 'pocketmods:thunder_wand');
        assert.equal(mock.dimension('overworld').spawned.length, 1);
    });

    it('refuses to strike something within 4 blocks of you', () => {
        const player = makePlayer({ location: { x: 0, y: 64, z: 0 } });
        player.hit = { x: 1, y: 63, z: 1 }; // the target is about 2 blocks away
        mock.fireItemUse(player, 'pocketmods:thunder_wand');

        assert.equal(player.actionBars.at(-1), 'Too close to strike!');
        assert.equal(mock.dimension('overworld').spawned.length, 0);

        // A refused strike does not use up the cooldown.
        player.hit = { x: 10, y: 64, z: 10 };
        mock.fireItemUse(player, 'pocketmods:thunder_wand');
        assert.equal(mock.dimension('overworld').spawned.length, 1);
    });
});

describe('/sethome and /home', () => {
    it('/sethome saves the rounded position on the next tick', () => {
        const player = makePlayer({ location: { x: 10.26, y: 64.04, z: -3.149 } });
        const result = mock.runCommand('pocketmods:sethome', { sourceEntity: player });

        assert.equal(result.status, CustomCommandStatus.Success);
        assert.equal(player.getDynamicProperty('pocketmods_home'), undefined, 'saved on the next tick');
        mock.flush();
        assert.deepEqual(JSON.parse(player.getDynamicProperty('pocketmods_home')), {
            x: 10.3,
            y: 64,
            z: -3.1,
            dimension: 'overworld',
        });
        assert.equal(player.messages.at(-1), 'Home saved at 10.3, 64, -3.1 (overworld).');
    });

    it('/sethome records the dimension name the teleport command expects', () => {
        const player = makePlayer({ dimension: 'nether' });
        mock.runCommand('pocketmods:sethome', { sourceEntity: player });
        mock.flush();
        assert.equal(JSON.parse(player.getDynamicProperty('pocketmods_home')).dimension, 'nether');
    });

    it('/home without a saved home explains how to set one', () => {
        const player = makePlayer();
        mock.runCommand('pocketmods:home', { sourceEntity: player });
        mock.flush();
        assert.equal(player.messages.at(-1), 'You have no home yet. Stand somewhere and type /sethome.');
        assert.deepEqual(player.teleports, []);
    });

    it('/home teleports you to a home saved in another dimension', () => {
        const player = makePlayer();
        player.setDynamicProperty(
            'pocketmods_home',
            JSON.stringify({ x: 100, y: 70, z: -20, dimension: 'nether' }),
        );
        mock.runCommand('pocketmods:home', { sourceEntity: player });
        mock.flush();

        assert.deepEqual(player.teleports, [
            { location: { x: 100, y: 70, z: -20 }, dimension: 'minecraft:nether' },
        ]);
        assert.equal(player.messages.at(-1), 'Welcome home!');
    });

    it('damaged saved data is treated as no home', () => {
        for (const broken of ['not json', '{"x":"a","y":1,"z":2,"dimension":"overworld"}', 'null']) {
            const player = makePlayer();
            player.setDynamicProperty('pocketmods_home', broken);
            mock.runCommand('pocketmods:home', { sourceEntity: player });
            mock.flush();
            assert.equal(
                player.messages.at(-1),
                'You have no home yet. Stand somewhere and type /sethome.',
                `saved data: ${broken}`,
            );
        }
    });

    it('an unknown saved dimension is reported, not thrown', () => {
        const player = makePlayer();
        player.setDynamicProperty(
            'pocketmods_home',
            JSON.stringify({ x: 1, y: 2, z: 3, dimension: 'moon' }),
        );
        mock.runCommand('pocketmods:home', { sourceEntity: player });

        assert.doesNotThrow(() => mock.flush());
        assert.equal(
            player.messages.at(-1),
            'Could not teleport you home. Save your home again with /sethome.',
        );
    });

    it('non-player callers (command blocks, consoles) are refused', () => {
        for (const name of ['pocketmods:sethome', 'pocketmods:home', 'pocketmods:menu']) {
            const result = mock.runCommand(name, {});
            assert.equal(result.status, CustomCommandStatus.Failure, name);
            assert.equal(result.message, 'Only players can use this command.', name);
        }
    });
});

describe('Mod Menu window', () => {
    it('the Mod Menu item opens the window', () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();

        const entry = openForm(player);
        assert.ok(entry, 'the window should open');
        assert.equal(entry.form.titleText, 'Pocket Mods');
    });

    it('/menu opens the window', () => {
        const player = makePlayer();
        const result = mock.runCommand('pocketmods:menu', { sourceEntity: player });
        assert.equal(result.status, CustomCommandStatus.Success);
        mock.flush();

        assert.equal(openForm(player).form.titleText, 'Pocket Mods');
    });

    it('players without operator rights only see the home options', () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();

        const entry = openForm(player);
        assert.deepEqual(formButtons(entry), ['Set Home', 'Go Home', 'Mod Guide']);
        assert.match(entry.form.bodyText, /Game mode, difficulty, and item options are for operators\./);
    });

    it('operators also see the game mode, difficulty, and item options', () => {
        const player = makePlayer({ operator: true });
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();

        assert.deepEqual(formButtons(openForm(player)), [
            'Set Home',
            'Go Home',
            'Mod Guide',
            'Game Mode',
            'Difficulty',
            'Get Mod Items',
        ]);
    });

    it('the window shows the saved home', () => {
        const player = makePlayer();
        player.setDynamicProperty(
            'pocketmods_home',
            JSON.stringify({ x: 5, y: 64, z: 9, dimension: 'overworld' }),
        );
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();

        assert.match(openForm(player).form.bodyText, /^Home: 5, 64, 9 \(overworld\)/);
    });

    it('Set Home in the window saves your position, the same as /sethome', async () => {
        const player = makePlayer({ location: { x: 1, y: 2, z: 3 } });
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 0);

        assert.equal(player.messages.at(-1), 'Home saved at 1, 2, 3 (overworld).');
        assert.deepEqual(JSON.parse(player.getDynamicProperty('pocketmods_home')), {
            x: 1,
            y: 2,
            z: 3,
            dimension: 'overworld',
        });
    });

    it('Go Home in the window teleports you', async () => {
        const player = makePlayer();
        player.setDynamicProperty(
            'pocketmods_home',
            JSON.stringify({ x: 7, y: 80, z: 7, dimension: 'the_end' }),
        );
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 1);

        assert.deepEqual(player.teleports, [
            { location: { x: 7, y: 80, z: 7 }, dimension: 'minecraft:the_end' },
        ]);
    });

    it('closing the window changes nothing', async () => {
        const player = makePlayer({ operator: true });
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await closeForm(player);

        assert.deepEqual(player.messages, []);
        assert.equal(player.getDynamicProperty('pocketmods_home'), undefined);
        assert.equal(player.getGameMode(), GameMode.Survival);
        assert.equal(openForm(player), undefined);
    });

    it('Mod Guide explains the mods, and Back returns to the window', async () => {
        const player = makePlayer();
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 2); // Mod Guide

        const guide = openForm(player);
        assert.equal(guide.form.titleText, 'Mod Guide');
        assert.match(guide.form.bodyText, /Wind Charm: right-click/);
        assert.match(guide.form.bodyText, /Thunder Wand: right-click/);
        assert.match(guide.form.bodyText, /type \/menu/);

        await press(player, 0); // Back
        assert.equal(openForm(player).form.titleText, 'Pocket Mods');
    });

    it('an operator can switch their own game mode', async () => {
        const player = makePlayer({ operator: true });
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 3); // Game Mode

        const modes = openForm(player);
        assert.equal(modes.form.titleText, 'Game Mode');
        assert.deepEqual(formButtons(modes), [
            'Survival (current)',
            'Creative',
            'Adventure',
            'Spectator',
            'Back',
        ]);

        await press(player, 1); // Creative
        assert.equal(player.getGameMode(), GameMode.Creative);
        assert.equal(player.messages.at(-1), 'Game mode set to Creative.');
    });

    it('the game mode menu can go back without changing anything', async () => {
        const player = makePlayer({ operator: true });
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 3); // Game Mode
        await press(player, 4); // Back

        assert.equal(openForm(player).form.titleText, 'Pocket Mods');
        assert.equal(player.getGameMode(), GameMode.Survival);
    });

    it('an operator who loses operator rights is refused when they pick a mode', async () => {
        const player = makePlayer({ operator: true });
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 3); // Game Mode, while still an operator

        player.playerPermissionLevel = PlayerPermissionLevel.Member;
        await press(player, 2); // Adventure

        assert.equal(player.getGameMode(), GameMode.Survival);
        assert.equal(player.messages.at(-1), 'Only operators can use that option.');
    });

    it('an operator can change the world difficulty', async () => {
        const player = makePlayer({ operator: true });
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 4); // Difficulty

        const difficulty = openForm(player);
        assert.equal(difficulty.form.titleText, 'Difficulty');
        assert.match(difficulty.form.bodyText, /Current difficulty: Normal\./);
        assert.deepEqual(formButtons(difficulty), ['Peaceful', 'Easy', 'Normal (current)', 'Hard', 'Back']);

        await press(player, 3); // Hard
        assert.equal(world.getDifficulty(), Difficulty.Hard);
        assert.equal(player.messages.at(-1), 'Difficulty set to Hard for this world.');
    });

    it('an operator can add a Mod Menu item to their inventory', async () => {
        const player = makePlayer({ operator: true });
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 5); // Get Mod Items

        assert.deepEqual(formButtons(openForm(player)), ['Wind Charm', 'Thunder Wand', 'Mod Menu', 'Back']);
        await press(player, 2); // Mod Menu

        assert.deepEqual(player.inventory, [{ typeId: 'pocketmods:mod_menu', amount: 1 }]);
        assert.equal(player.messages.at(-1), 'Added Mod Menu to your inventory.');
    });

    it('a full inventory is reported, not silently lost', async () => {
        const player = makePlayer({ operator: true });
        player.inventoryCapacity = 0;
        mock.fireItemUse(player, 'pocketmods:mod_menu');
        mock.flush();
        await press(player, 5); // Get Mod Items
        await press(player, 0); // Wind Charm

        assert.deepEqual(player.inventory, []);
        assert.equal(player.messages.at(-1), 'Your inventory is full.');
    });
});
