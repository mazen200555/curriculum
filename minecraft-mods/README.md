# Pocket Mods

Three small add-ons for Minecraft Bedrock Edition, the version that runs on phones
(the "Minecraft" app from Google Play or the App Store, also called Pocket Edition).

Java Edition mods (Forge, Fabric) do not run on phones. Bedrock's equivalent is an
**add-on**: a behavior pack (items, recipes, and JavaScript logic) plus a resource pack
(textures and names), shipped together in one `.mcaddon` file.

This add-on is not affiliated with or endorsed by Mojang or Microsoft.

## What's inside

| Mod | What it does | How to get it |
| --- | --- | --- |
| **Wind Charm** | Right-click to launch yourself forward and up. You slow-fall for 5 seconds, so the landing is soft. 4-second cooldown. | Crafting table: 4 feathers around a stick, plus-shaped |
| **Thunder Wand** | Right-click to call lightning on the block you are looking at (up to 60 blocks away, not closer than 4). 3-second cooldown. | Crafting table: amethyst shard at the top right, two sticks running down to the left |
| **`/sethome` and `/home`** | `/sethome` saves your position and dimension. `/home` teleports you back, even from another dimension. | Type them in chat. No cheats needed. |

## Install on your phone

You need the paid Minecraft app for your phone, version **1.21.100 or newer**. The
add-on won't load on older versions.

1. **Get the file onto your phone.** Download `Pocket_Mods.mcaddon` from this folder on
   GitHub. In the file view, use the download button.
2. **Open it with Minecraft.**
   - Android: tap the downloaded file, then choose Minecraft.
   - iPhone or iPad: open the file, tap Share, then choose Minecraft. If Minecraft isn't
     listed, use "Open in" and pick Minecraft.

   Minecraft imports both packs and shows a confirmation.
3. **Turn the packs on for a world.** Create a new world, or edit an existing one. In
   its settings, find **Behavior Packs** and **Resource Packs** and turn on
   **Pocket Mods** in both lists.
4. **No experiments are needed.** These mods use stable Script API features only. See
   Troubleshooting if the commands don't work.
5. **Get the items.** Craft them using the recipes above, or in Creative mode look under
   the Equipment tab.

## Troubleshooting

- **The file won't import.** Make sure it's named `Pocket_Mods.mcaddon` and that you
  opened it with Minecraft. Also check that your Minecraft version is 1.21.100 or newer.
- **Items show up with odd names, like `item.pocketmods:wind_charm`, or with no texture.**
  The resource pack isn't turned on for this world. Turn on Pocket Mods under Resource
  Packs.
- **Wand or charm does nothing.** The behavior pack isn't turned on for this world. Turn
  on Pocket Mods under Behavior Packs.
- **`/home` or `/sethome` is "unknown command".** Turn on the behavior pack first. If that
  doesn't work, go to the world settings, open **Experiments**, and turn on **Beta APIs**.
  That option can't be undone for the world, so copy the world first.

## Edit and rebuild

```
minecraft-mods/
  Pocket_Mods_BP/          behavior pack
    manifest.json
    pack_icon.png
    items/                 item definitions (wind_charm.json, thunder_wand.json)
    recipes/               crafting recipes
    scripts/main.js        all the logic, with settings at the top
  Pocket_Mods_RP/          resource pack
    manifest.json
    pack_icon.png
    textures/item_texture.json   maps item IDs to textures
    textures/items/        16x16 PNG art
    texts/en_US.lang       item names
    texts/languages.json
  build.py                 packs both folders into Pocket_Mods.mcaddon
  Pocket_Mods.mcaddon      the built file to copy to your phone
```

- **Tune the mods:** open `Pocket_Mods_BP/scripts/main.js`. The settings at the top
  control cooldowns, how hard the charm launches, and the wand's range.
- **Change the art:** replace the PNGs in `Pocket_Mods_RP/textures/items/`. Keep the file
  names the same.
- **Rebuild:** from this folder, run `python3 build.py`. It needs Python 3 and nothing
  else. It writes a new `Pocket_Mods.mcaddon`. Before you rebuild, increase the `version`
  in both `manifest.json` files, so Minecraft treats the new file as an update.

## Status

The add-on was built and checked on a computer, not on a phone:

- All JSON files parse. Every item, texture, name, and recipe reference matches.
- The script type-checks against the official `@minecraft/server` type definitions for
  version 2.1.0 (the minimum this add-on depends on) and version 2.10.0.
- The script's logic (cooldowns, launching, lightning, home saving and teleporting)
  passes automated tests run against a stand-in for the game API.

It has **not** been run in the real game yet. Launch strength, lightning range, sounds,
and how the textures look on a phone are all unverified. Expect to tune the settings.
