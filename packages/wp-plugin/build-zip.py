#!/usr/bin/env python3
"""
Build the distributable WordPress plugin zip.

CRITICAL: WordPress runs on Linux and follows the ZIP spec, which requires
forward-slash ('/') path separators. A zip built on Windows with backslash
separators (e.g. via Explorer "Send to > Compressed folder" or some tools)
produces entries like `scrollpop\\scrollpop.php`, which WordPress cannot read as
a folder — it fails with "Plugin file does not exist." on activation.

Python's zipfile always writes forward slashes, so this script is the safe,
deterministic way to package the plugin. Output extracts to a single top-level
`scrollpop/` folder → installs as wp-content/plugins/scrollpop/scrollpop.php.

Usage:  python build-zip.py   (or: pnpm --filter @scrollpop/wp-plugin package)
"""
import os
import zipfile

SRC = "scrollpop"                       # plugin source dir (the WP plugin folder)
OUT = os.path.join("dist", "scrollpop-wp.zip")


def main() -> None:
    if not os.path.isdir(SRC):
        raise SystemExit(f"error: source dir '{SRC}/' not found (run from packages/wp-plugin)")
    os.makedirs("dist", exist_ok=True)
    if os.path.exists(OUT):
        os.remove(OUT)

    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(SRC):
            for f in sorted(files):
                full = os.path.join(root, f)
                # arcname relative to this dir, forced to forward slashes.
                arc = os.path.relpath(full, ".").replace(os.sep, "/")
                z.write(full, arc)
                count += 1

    # Verify: every entry must use forward slashes and live under scrollpop/.
    with zipfile.ZipFile(OUT) as z:
        for name in z.namelist():
            if "\\" in name or not name.startswith("scrollpop/"):
                raise SystemExit(f"error: malformed zip entry '{name}'")

    print(f"Built {OUT} ({count} files) — entries verified forward-slash + scrollpop/ root")


if __name__ == "__main__":
    main()
