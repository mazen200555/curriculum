#!/usr/bin/env python3
"""Checks that the Pocket Mods add-on files agree with each other.

It checks JSON syntax, manifests and their dependencies, item and texture and language
references, recipes, script imports, and that Pocket_Mods.mcaddon matches the pack folders.
Standard library only. Run from anywhere:

    python3 minecraft-mods/tests/validate_pack.py
"""
import json
import pathlib
import re
import struct
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
BP = ROOT / 'Pocket_Mods_BP'
RP = ROOT / 'Pocket_Mods_RP'
MCADDON = ROOT / 'Pocket_Mods.mcaddon'

# Vanilla item identifiers used in recipes. Checked against @minecraft/vanilla-data.
VANILLA_ITEMS = {
    'minecraft:amethyst_shard',
    'minecraft:book',
    'minecraft:feather',
    'minecraft:glass_pane',
    'minecraft:stick',
}
UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'

problems = []
checks = 0


def check(condition, message):
    global checks
    checks += 1
    if not condition:
        problems.append(message)


def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def png_size(path):
    raw = path.read_bytes()
    if raw[:8] != PNG_SIGNATURE:
        return None
    return struct.unpack('>II', raw[16:24])


def main():
    # 1. Every JSON file parses.
    for path in sorted(ROOT.rglob('*.json')):
        if 'node_modules' in path.parts:
            continue
        try:
            load_json(path)
        except ValueError as error:
            check(False, f'invalid JSON in {path.relative_to(ROOT)}: {error}')

    # 2. Manifests.
    bp = load_json(BP / 'manifest.json')
    rp = load_json(RP / 'manifest.json')
    for name, manifest in (('BP', bp), ('RP', rp)):
        check(manifest['format_version'] == 2, f'{name} format_version must be 2')
        check(manifest['header']['min_engine_version'] == [1, 21, 100], f'{name} min_engine_version')
        check(bool(UUID_RE.match(manifest['header']['uuid'])), f'{name} header uuid format')
        for module in manifest['modules']:
            check(bool(UUID_RE.match(module['uuid'])), f'{name} module uuid format')
            check(module['version'] == manifest['header']['version'], f'{name} module version should match header')
    check(bp['header']['version'] == rp['header']['version'], 'BP and RP header versions should match')
    uuids = [bp['header']['uuid'], rp['header']['uuid']] + [m['uuid'] for m in bp['modules'] + rp['modules']]
    check(len(set(uuids)) == len(uuids) == 5, 'all five uuids must be distinct')
    check(sorted(m['type'] for m in bp['modules']) == ['data', 'script'], 'BP module types')
    check(rp['modules'][0]['type'] == 'resources', 'RP module type must be resources')

    script_module = [m for m in bp['modules'] if m['type'] == 'script'][0]
    check(script_module['entry'] == 'scripts/main.js', 'script entry should be scripts/main.js')
    check((BP / script_module['entry']).is_file(), 'script entry file is missing')

    deps = bp['dependencies']
    rp_dep = [d for d in deps if d.get('uuid') == rp['header']['uuid']]
    check(len(rp_dep) == 1 and rp_dep[0]['version'] == rp['header']['version'],
          'BP must depend on the RP header uuid at the RP header version')
    server_dep = [d for d in deps if d.get('module_name') == '@minecraft/server']
    check(len(server_dep) == 1 and server_dep[0]['version'] == '2.1.0', 'BP must depend on @minecraft/server 2.1.0')
    ui_dep = [d for d in deps if d.get('module_name') == '@minecraft/server-ui']
    check(len(ui_dep) == 1 and ui_dep[0]['version'] == '2.0.0', 'BP must depend on @minecraft/server-ui 2.0.0')

    # 3. Scripts: imports between files must resolve, and every item the code uses must exist.
    scripts = sorted((BP / 'scripts').glob('*.js'))
    script_names = {p.name for p in scripts}
    check('main.js' in script_names, 'scripts/main.js is missing')
    for script in scripts:
        text = script.read_text(encoding='utf-8')
        for target in re.findall(r"from\s+'\./([^']+)'", text):
            check(target in script_names, f'{script.name} imports missing ./{target}')
    config_text = (BP / 'scripts' / 'config.js').read_text(encoding='utf-8')
    all_script_text = '\n'.join(p.read_text(encoding='utf-8') for p in scripts)

    # 4. Items, textures, names.
    items = {}
    for path in sorted((BP / 'items').glob('*.json')):
        data = load_json(path)
        item = data['minecraft:item']
        identifier = item['description']['identifier']
        items[identifier] = path.stem
        check(data['format_version'] == '1.21.90', f'{path.name} format_version')
        check(identifier.startswith('pocketmods:'), f'{path.name} namespace')
        check(item['components']['minecraft:icon'] == identifier, f'{path.name} icon must equal the identifier')
        check(item['components']['minecraft:max_stack_size'] == 1, f'{path.name} max stack size')
        check(f"'{identifier}'" in config_text, f'config.js does not define {identifier}')
    check(set(items) == {'pocketmods:wind_charm', 'pocketmods:thunder_wand', 'pocketmods:mod_menu'},
          f'unexpected item set: {sorted(items)}')

    texture_map = load_json(RP / 'textures' / 'item_texture.json')
    check(texture_map['texture_name'] == 'atlas.items', 'texture_name must be atlas.items')
    check(set(texture_map['texture_data']) == set(items), 'item_texture.json must list exactly the items')
    for identifier, entry in texture_map['texture_data'].items():
        png = RP / (entry['textures'] + '.png')
        check(png.is_file(), f'missing texture {png.relative_to(ROOT)}')
        if png.is_file():
            check(png_size(png) == (16, 16), f'{png.name} must be a 16x16 PNG')

    lang = {}
    for line in (RP / 'texts' / 'en_US.lang').read_text(encoding='utf-8').splitlines():
        if '=' in line:
            key, value = line.split('=', 1)
            lang[key] = value
    for identifier in items:
        check(f'item.{identifier}.name' in lang, f'en_US.lang has no name for {identifier}')
    check('en_US' in load_json(RP / 'texts' / 'languages.json'), 'languages.json must list en_US')

    # 5. Recipes.
    for path in sorted((BP / 'recipes').glob('*.json')):
        data = load_json(path)
        if 'minecraft:recipe_shaped' in data:
            recipe = data['minecraft:recipe_shaped']
            pattern, key = recipe['pattern'], recipe['key']
            check(len(pattern) == 3 and all(len(row) == 3 for row in pattern), f'{path.name} pattern must be 3x3')
            used = {ch for row in pattern for ch in row if ch != ' '}
            check(used == set(key), f'{path.name}: key symbols do not match the pattern')
            ingredients = [spec['item'] for spec in key.values()]
        elif 'minecraft:recipe_shapeless' in data:
            recipe = data['minecraft:recipe_shapeless']
            ingredients = [spec['item'] for spec in recipe['ingredients']]
            check(len(ingredients) >= 2, f'{path.name} needs at least two ingredients')
        else:
            check(False, f'{path.name} is not a shaped or shapeless recipe')
            continue
        check(recipe['tags'] == ['crafting_table'], f'{path.name} tags')
        check(recipe['result']['item'] in items, f'{path.name} result is not a defined item')
        check(recipe['description']['identifier'] == recipe['result']['item'],
              f'{path.name} recipe identifier should match its result')
        for ingredient in ingredients:
            check(ingredient in VANILLA_ITEMS or ingredient in items, f'{path.name} unknown ingredient {ingredient}')

    # 6. Command names used by the script.
    for command in ('pocketmods:sethome', 'pocketmods:home', 'pocketmods:menu'):
        check(f"'{command}'" in config_text, f'config.js does not define command {command}')
    check("'pocketmods_home'" in config_text, 'home property name missing from config.js')
    check('ambient.weather.thunder' in all_script_text and 'item.trident.riptide_1' in all_script_text,
          'sound ids missing from the scripts')

    # 7. Icons.
    for icon in (BP / 'pack_icon.png', RP / 'pack_icon.png'):
        check(icon.is_file() and icon.read_bytes()[:8] == PNG_SIGNATURE, f'{icon.name} must be a PNG')

    # 8. The built .mcaddon matches the pack folders.
    check(MCADDON.is_file(), 'Pocket_Mods.mcaddon is missing; run python3 build.py')
    if MCADDON.is_file():
        with zipfile.ZipFile(MCADDON) as archive:
            check(archive.testzip() is None, 'zip CRC check failed')
            names = archive.namelist()
            for name in names:
                check(not name.startswith('/') and '\\' not in name and not name.endswith('/'),
                      f'bad zip entry {name}')
            on_disk = sorted(
                p.relative_to(ROOT).as_posix()
                for folder in (BP, RP) for p in folder.rglob('*') if p.is_file()
            )
            check(sorted(names) == on_disk,
                  f'Pocket_Mods.mcaddon is out of date with the pack folders: {sorted(set(names) ^ set(on_disk))}')
            for name in names:
                if (ROOT / name).is_file():
                    check(archive.read(name) == (ROOT / name).read_bytes(),
                          f'{name} in Pocket_Mods.mcaddon is out of date; run python3 build.py')

    print(f'{checks} checks run, {len(problems)} problem(s)')
    for problem in problems:
        print('  FAIL:', problem)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
