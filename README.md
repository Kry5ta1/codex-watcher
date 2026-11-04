# Codex Watcher

**Language:** English | [中文](README.zh-CN.md)

Codex Watcher is a Windows desktop widget for keeping the Codex quota for your subscription and available reset credits visible at a glance.

The web dashboard is included as a secondary entry for debugging, previewing, and fallback viewing.

![Codex Watcher preview](public/usage-header.png)

## Windows Desktop Card

The desktop card uses Electron to host a Next.js page in a small Windows desktop window.

It detects the subscription from the quota response: Plus shows the 5-hour quota; Pro (including ProLite/ProMax) and supported Business/Enterprise/Edu plans show the weekly quota. It also shows the available reset count and the reset tickets that expire soonest. Unknown plans and missing quota windows produce a warning instead of displaying a different window or a fabricated 0%.

It gives short usage guidance based on quota levels and reset expiry times, helping you decide whether to wait or spend a saved reset.

It supports a tray menu, show or hide actions, refresh, always-on-top, position lock, launch at startup, and theme-specific background transparency.

Window position, size, always-on-top, lock, startup, and appearance settings are saved in the local Electron user data directory.

## Pacific reference clock

Both the desktop card and web dashboard show a live US Pacific clock in 12-hour format (for example, `10:30:45 AM PST`), with the Pacific date and UTC offset. It uses `America/Los_Angeles`, switching automatically between PST (UTC−8) and PDT (UTC−7). Use it to compare announcements that explicitly say PT/PST/PDT; announcements in other time zones still need conversion.

The clock uses your computer's system time and updates independently every second. It is a time reference, not an automatic reset countdown or a connection to X. Keep your operating system clock synchronized. The desktop card expands to its content without scrollbars; drag the top title bar to move it.

## Requirements

- Windows
- Node.js 22.12.0 or newer
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

## GitHub Actions packaging

The **Build Windows Installer** workflow builds Windows x64 installers on pull requests that change the app/build inputs, or through **Actions → Build Windows Installer → Run workflow** on the chosen branch.

It runs tests and the production build, then packages the installer. Download `Codex-Watcher-0.3.0-windows-x64` from the successful run's **Artifacts** section; it contains `Codex-Watcher-Setup-0.3.0.exe` and its SHA256 checksum. Artifact names use the version in `package.json` and are retained for 14 days.

The workflow only creates build artifacts. It does not publish GitHub Releases or overwrite old release installers. A failed packaging command fails the run even if an installer file exists.

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

## Companion Themes

Use the theme selector above the Pacific clock to choose **经典**, **深海** (navy/cyan whale maid), or **白龙** (pearl/lavender dragon). Both new themes include original AI-generated chibi artwork. The quota, reset tickets, clock, and settings stay separate from the artwork.

- **专注** hides character decorations while preserving the selected palette and all monitoring functions.
- Desktop choices are stored in the existing local settings file and survive a restart, including a different local server port. Web choices use browser local storage.
- Controls support keyboard focus and selected-state labels; gentle hover movement respects reduced-motion preferences.
- No external image requests or additional quota polling are introduced. See [artwork provenance](docs/theme-artwork.md) for reference links and asset details.

## Desktop Size and Transparency

Background transparency follows the selected theme: **classic 15%**, **deep sea 10%**, and **white dragon 0%** (85%, 90%, and 100% background opacity). Text, controls, and quota meters remain fully opaque. Old global transparency values are ignored; the settings panel and tray show the current theme value.

The desktop window starts at **440 × 780 logical pixels** and grows to fit its measured content after rendering. The ordinary minimum width is **420 logical pixels**; minimum height follows the content, including theme artwork, up to three reset tickets, errors, and the open settings panel. Larger manually chosen sizes are preserved. Focus mode can reduce the required minimum height.

There are no desktop scrollbars. If a monitor's usable work area cannot contain the full card, the complete card scales down uniformly to fit. This also handles high Windows display scaling, smaller displays, and moving between monitors. Font and control sizes are smaller in this fallback; use a larger work area or focus mode for better readability. Disconnected-monitor positions and oversized saved windows are clamped back into an available display. The web widget also fits within its viewport but cannot resize the browser window.

## Privacy and Safety

Codex Watcher only reads the local Codex auth file and calls Codex/ChatGPT quota endpoints.

The project does not store tokens, account IDs, private keys, or `.env*.local` files in the repository.

The project does not redeem reset credits; it only displays quota status and usage guidance.

## Credits

This project is based on the upstream project. Thanks to @jordan-edai.

https://github.com/jordan-edai/codex-reset-watcher

## License

This project is licensed under the MIT License.
