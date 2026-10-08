// Pocket Mods settings. Change a number here, then run build.py to rebuild the add-on.
// Time is measured in ticks: 20 ticks = 1 second.

export const WIND_CHARM = {
    id: 'pocketmods:wind_charm',
    name: 'Wind Charm',
    cooldownTicks: 80, // 4 seconds between uses
    forwardStrength: 1.4, // push in the direction you are looking
    upStrength: 1.0, // push upward
    slowFallTicks: 100, // 5 seconds of slow falling so the landing is soft
};

export const THUNDER_WAND = {
    id: 'pocketmods:thunder_wand',
    name: 'Thunder Wand',
    cooldownTicks: 60, // 3 seconds between strikes
    range: 60, // how far away (in blocks) you can target
    minDistance: 4, // closer than this and the strike could hit you
};

export const MOD_MENU = {
    id: 'pocketmods:mod_menu',
    name: 'Mod Menu',
};

// Game mode changes, difficulty changes, and "Get Mod Items" are limited to operators.
// Set this to false to let every player use them. Only do that in worlds you trust.
export const ADMIN_OPTIONS_NEED_OPERATOR = true;

// Slash command names. Players type the short forms (/sethome, /home, /menu). The README
// lists the full names (pocketmods:sethome and so on) as a fallback.
export const COMMANDS = {
    sethome: 'pocketmods:sethome',
    home: 'pocketmods:home',
    menu: 'pocketmods:menu',
};

// The dynamic property that stores each player's home.
export const HOME_PROPERTY = 'pocketmods_home';
