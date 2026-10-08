# Pocket Mods

Small mods for Minecraft Bedrock Edition, the version that runs on phones (the "Minecraft" app from Google Play or the App Store, also called Pocket Edition).

Java Edition mods (Forge, Fabric) do not run on phones. Bedrock's equivalent is an **add-on**: a behavior pack (items, recipes, and JavaScript logic) plus a resource pack (textures and names), shipped together in one `.mcaddon` file.

This add-on is not affiliated with or endorsed by Mojang or Microsoft.

## What's inside

| Mod | What it does | How to get it |
| --- | --- | --- |
| **Wind Charm** | Right-click to launch yourself forward and up. You slow-fall for 5 seconds, so the landing is soft. 4-second cooldown. | Crafting table: 4 feathers around a stick, plus-shaped |
| **Thunder Wand** | Right-click to call lightning on the block you are looking at (up to 60 blocks away, not closer than 4). 3-second cooldown. | Crafting table: amethyst shard at the top right, two sticks running down to the left |
| **Mod Menu** | Right-click it (or type `/menu`) to open the Pocket Mods window. See below. | Crafting table: a book and a glass pane, in either order |
| **`/sethome` and `/home`** | `/sethome` saves your position and dimension. `/home` teleports you back, even from another dimension. | Type them in chat. No cheats needed. |

### The Mod Menu window

The window has buttons for everyone:

- **Set Home** and **Go Home**: the same as `/sethome` and `/home`.
- **Mod Guide**: a short explanation of each mod.

Operators also see these buttons. They are the classic Minecraft settings:

- **Game Mode**: Survival, Creative, Adventure, or Spectator, for you.
- **Difficulty**: Peaceful, Easy, Normal, or Hard, for the whole world.
- **Get Mod Items**: adds a Wind Charm, Thunder Wand, or Mod Menu to your inventory.

**Why only operators?** A game mode or difficulty change affects everyone who plays in a shared world, so an admin should control it. If you made the world, you are its operator. In a world someone else owns, the owner has to give you operator permission. Players who are not operators don't see these buttons at all. To let everyone use them, set `ADMIN_OPTIONS_NEED_OPERATOR` to `false` in `config.js`, then rebuild.

## Install on your phone

You need the paid Minecraft app for your phone, version **1.21.100 or newer**. The add-on won't load on older versions.

1. **Get the file onto your phone.** Download `Pocket_Mods.mcaddon` from this folder on GitHub. In the file view, use the download button.
2. **Open it with Minecraft.**
   - Android: tap the downloaded file, then choose Minecraft.
   - iPhone or iPad: open the file, tap Share, then choose Minecraft. If Minecraft isn't listed, use "Open in" and pick Minecraft. (Not tested on an iPhone yet.)

   Minecraft imports both packs and shows a confirmation.
3. **Turn the packs on for a world.** Create a new world, or edit an existing one. In its settings, find **Behavior Packs** and **Resource Packs** and turn on **Pocket Mods** in both lists.
4. **No experiments should be needed.** These mods use only the stable Script API. See Troubleshooting if the commands don't work.
5. **Get the items.** Craft them using the recipes above, or in Creative mode look under the Equipment tab. Operators can also use **Mod Menu**, then **Get Mod Items**.
6. **Open the window.** Right-click the Mod Menu item, or type `/menu`.

## Troubleshooting

- **The file won't import.** Make sure it's named `Pocket_Mods.mcaddon` and that you opened it with Minecraft. Also check that your Minecraft version is 1.21.100 or newer.
- **Items show up with odd names, like `item.pocketmods:wind_charm`, or with no texture.** The resource pack isn't turned on for this world. Turn on Pocket Mods under Resource Packs.
- **Wand or charm does nothing.** The behavior pack isn't turned on for this world. Turn on Pocket Mods under Behavior Packs.
- **`/home`, `/sethome`, or `/menu` says "unknown command".** Turn on the behavior pack first. If the short names still don't work, type the full names `/pocketmods:home`, `/pocketmods:sethome`, or `/pocketmods:menu`. If those fail too, the script isn't loading. Go to the world settings, open **Experiments**, and turn on **Beta APIs**. That option can't be undone for the world, so copy the world first.
- **The Mod Menu item does nothing.** Check that the behavior pack is on for the world. The window uses a newer script module (`@minecraft/server-ui`). If it still doesn't open, update Minecraft to the latest version.
- **I don't see Game Mode or Difficulty.** Those buttons are for operators only. Ask the world owner to give you operator permission, or set `ADMIN_OPTIONS_NEED_OPERATOR` to `false` in `config.js` and rebuild.

## Edit and rebuild

```
minecraft-mods/
  Pocket_Mods_BP/                 behavior pack
    manifest.json
    pack_icon.png
    items/                        wind_charm, thunder_wand, mod_menu
    recipes/                      crafting recipes
    scripts/
      config.js                   settings: cooldowns, strengths, ranges, operator-only switch
      home.js                     /sethome, /home, and the Set Home and Go Home buttons
      menu.js                     the Mod Menu window
      main.js                     items, slash commands, and wiring
  Pocket_Mods_RP/                 resource pack
    manifest.json
    pack_icon.png
    textures/item_texture.json    maps item IDs to textures
    textures/items/               16x16 PNG art
    texts/en_US.lang              item names
    texts/languages.json
  tests/
    pocket_mods.test.mjs          behavior tests
    validate_pack.py              consistency checks
    fake_modules/                 stand-ins for the game's script modules (tests only)
  build.py                        packs both folders into Pocket_Mods.mcaddon
  Pocket_Mods.mcaddon             the built file to copy to your phone
```

- **Tune the mods:** open `Pocket_Mods_BP/scripts/config.js`. It has the cooldowns, how hard the charm launches, the wand's range, and the operator-only switch.
- **Change the window:** edit `Pocket_Mods_BP/scripts/menu.js`. Each button is listed there.
- **Change the art:** replace the PNGs in `Pocket_Mods_RP/textures/items/`. Keep the file names the same.
- **Rebuild:** from this folder, run `python3 build.py`. It needs Python 3 and nothing else. Before you rebuild, increase the `version` in both `manifest.json` files so Minecraft treats the new file as an update. They are at 1.1.0 now.

## Checks

From the `minecraft-mods` folder:

```
node --test tests/pocket_mods.test.mjs     # 33 behavior tests (Node.js 18 or newer)
python3 tests/validate_pack.py             # 126 consistency checks (Python 3)
```

The behavior tests run the scripts against small stand-ins for the game's script modules. They cover cooldowns, launching, lightning, home saving and teleporting, the three slash commands, and the window: which buttons each kind of player sees, Set Home, Go Home, Mod Guide, game mode, difficulty, and item giving.

## Status

The add-on was built and checked on a computer, not on a phone.

**Checked:**

- All JSON files parse. Every item, texture, name, recipe, and script reference matches, and `Pocket_Mods.mcaddon` matches the pack folders (`validate_pack.py`).
- The script type-checks with TypeScript against the official type definitions for `@minecraft/server` 2.1.0 (the version the add-on depends on) and 2.10.0, together with `@minecraft/server-ui` 2.0.0.
- The behavior tests pass (`pocket_mods.test.mjs`).

**Not checked yet. These need the real game:**

- How the window looks and responds on a phone, and whether each button does what it says.
- Game mode and difficulty changes in the real game, including whether a game mode change lasts after a player leaves and rejoins the world.
- Get Mod Items in the real game, including what happens with a full inventory.
- Launch strength, lightning, sounds, and how the textures look. Expect to tune the numbers in `config.js`.
- The iPhone import steps.
- Whether 1.21.100 is the right minimum version. The window's UI module may need a newer game. If the add-on won't load on a current phone, that is worth reporting.
