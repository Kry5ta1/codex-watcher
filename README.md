# Codex Watcher

**Language:** English | [中文](README.zh-CN.md)

Codex Watcher is a Windows desktop widget for keeping Codex 5-hour quota, weekly quota, and available reset credits visible at a glance, helping you stay aware of quota status in real time.

The web dashboard is included as a secondary entry for debugging, previewing, and fallback viewing.

![Codex Watcher preview](public/usage-header.png)

## Windows Desktop Card

The desktop card uses Electron to host a Next.js page in a small Windows desktop window.

It shows Codex 5-hour quota, weekly quota, available reset count, and the reset tickets that expire soonest.

It gives short usage guidance based on quota levels and reset expiry times, helping you decide whether to wait or spend a saved reset.

It supports a tray menu, show or hide actions, refresh, always-on-top, position lock, launch at startup, and background transparency control.

Window position, size, always-on-top, lock, startup, and transparency settings are saved in the local Electron user data directory.

## Requirements

- Windows
- Node.js 20.9.0 or newer
- npm
- Codex Desktop signed in on the same machine

By default, Codex Watcher reads `%USERPROFILE%\.codex\auth.json`.

If your Codex config directory is elsewhere, set `CODEX_HOME`.

```env
CODEX_HOME=C:\path\to\.codex
```

## Run the Desktop Card

Install dependencies.

```powershell
npm install
```

Start the desktop card in production mode.

```powershell
npm run desktop:start
```

Build the Windows installer.

```powershell
npm run desktop:pack
```

The installer is written to `dist`.

## Development

When developing the desktop card, start Next.js first and then start Electron.

```powershell
# terminal 1
npm run dev

# terminal 2
npm run desktop:dev
```

You can also open the web dashboard directly.

```text
http://localhost:3000
```

The compact card page is available at `/widget`.

```text
http://localhost:3000/widget
```

## Checks

Run tests.

```powershell
npm test
```

Run the production build check.

```powershell
npm run build
```

## Privacy and Safety

Codex Watcher only reads the local Codex auth file and calls Codex/ChatGPT quota endpoints.

The project does not store tokens, account IDs, private keys, or `.env*.local` files in the repository.

The project does not redeem reset credits; it only displays quota status and usage guidance.

## Credits

This project is based on the upstream project. Thanks to @jordan-edai.

https://github.com/jordan-edai/codex-reset-watcher

## License

This project is licensed under the MIT License.
