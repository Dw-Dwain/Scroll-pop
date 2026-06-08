# ScrollPop — WordPress Plugin

Thin WordPress plugin that injects the ScrollPop snippet into `wp_head`. All popup
logic runs in the cloud; this plugin just connects a WordPress site via its public key.

## Structure
```
scrollpop/                  ← the actual WP plugin folder (this is what ships)
  scrollpop.php             ← main plugin file (header lives here)
  includes/
    class-scrollpop.php
    class-admin.php
    class-snippet.php
dist/scrollpop-wp.zip       ← packaged artifact users upload to WP admin
build-zip.py                ← repackages dist/scrollpop-wp.zip (see below)
```

## Building the zip

```bash
pnpm --filter @scrollpop/wp-plugin package   # or: cd packages/wp-plugin && python build-zip.py
```

> ⚠️ **Do NOT zip this with Windows Explorer ("Send to → Compressed folder") or any
> tool that writes backslash path separators.** WordPress runs on Linux and follows
> the ZIP spec (forward slashes only). A backslash-separated zip produces entries like
> `scrollpop\scrollpop.php`, which WordPress cannot read as a folder — activation fails
> with **"Plugin file does not exist."** `build-zip.py` uses Python's `zipfile`, which
> always writes forward slashes, and verifies every entry before finishing.

## Installing on a site
1. In WP admin: **Plugins → Add New → Upload Plugin** → choose `dist/scrollpop-wp.zip`.
2. Click **Install Now**, then **Activate**. It installs to `wp-content/plugins/scrollpop/`
   and activates with slug `scrollpop/scrollpop.php`.
3. Go to **Settings → ScrollPop**, paste the site's **Public Key**, save.

### If a previous broken upload left a bad folder
Delete any stale `wp-content/plugins/scrollpop-wp/` (or a `scrollpop` folder containing
files literally named `scrollpop\scrollpop.php`) via FTP/file manager before reinstalling
the corrected zip — WordPress won't clean up a malformed install on its own.
