#!/usr/bin/env python3
"""Pack the Pocket Mods behavior and resource packs into one .mcaddon file.

A .mcaddon is a ZIP archive whose top-level folders are the packs. Run it
after changing anything in Pocket_Mods_BP/ or Pocket_Mods_RP/:

    python3 build.py

It writes Pocket_Mods.mcaddon next to this file. Only the Python standard
library is needed.
"""
import json
import pathlib
import sys
import zipfile

HERE = pathlib.Path(__file__).resolve().parent
PACKS = ["Pocket_Mods_BP", "Pocket_Mods_RP"]
OUTPUT = HERE / "Pocket_Mods.mcaddon"


def pack_files(pack):
    """Yield every file in a pack folder, skipping hidden files and caches."""
    for path in sorted((HERE / pack).rglob("*")):
        if not path.is_file():
            continue
        if any(part.startswith(".") or part == "__pycache__" for part in path.parts):
            continue
        yield path


def main():
    # Check every JSON file first, so a typo fails here and not in the game.
    for pack in PACKS:
        if not (HERE / pack / "manifest.json").is_file():
            sys.exit(f"missing {pack}/manifest.json")
        for path in pack_files(pack):
            if path.suffix == ".json":
                try:
                    json.loads(path.read_text(encoding="utf-8"))
                except json.JSONDecodeError as error:
                    sys.exit(f"invalid JSON in {path.relative_to(HERE)}: {error}")

    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for pack in PACKS:
            for path in pack_files(pack):
                archive.write(path, path.relative_to(HERE).as_posix())

    print(f"wrote {OUTPUT.name} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
