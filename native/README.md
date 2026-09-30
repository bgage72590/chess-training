# Tempo as a Mac app and an iPhone/iPad app

Tempo is a web app, and the easiest way for someone else to use it is still the web address: open it in Safari
(or Chrome/Edge), then Add to Home Screen (iPhone, iPad) or Add to Dock (Mac). That needs no account and no
download, and it updates itself. See "Install it as an app" in the main README.

This folder holds the other route: the same app inside a native shell.

| Target | Shell | What you get | What a person needs |
| --- | --- | --- | --- |
| Mac | [Tauri](https://tauri.app) 2 (the Mac's own web view) | `Tempo.app` and a `.dmg`, one build for Intel and Apple silicon | Nothing to buy. The build is ad-hoc signed, so macOS asks for approval the first time (see below) |
| iPhone and iPad | [Capacitor](https://capacitorjs.com) 8 (WKWebView) | An Xcode project for one app that runs on both; CI builds it for the iOS Simulator | To put it on a real phone: the paid Apple Developer Program ($99 a year), then TestFlight or the App Store |

Nothing in this folder signs, uploads or publishes anything by itself.

## What is different inside the apps

The web app builds with `vite build --mode native` (`npm run build:native`), which:

- leaves out the service worker, the install banner and the update check (the files are inside the app; a new
  version is a new build of the app),
- skips the engine's start-up network probe (the engine's files are inside the app),
- hands out the hosted web address (`APP_URL`) in share links and sync links, since `capacitor://` and `tauri://`
  addresses open nowhere else,
- carries two of Pip's eight voices (Sunny and Rocket, about 84 MB) instead of all of them (about 340 MB, which
  mp3 does not compress); a voice chosen on another device that the app does not carry falls back to Sunny.
  `scripts/build-native.mjs --keep sunny,rocket,bella` changes which ones,
- adds a diagnostics page (`#/diag`, not reachable in a normal build) used by the CI run below.

The iPhone/iPad app also sets its audio session to media playback (`AppDelegate.swift`), so the silent switch on
the side of the phone does not mute the app's sounds.

## Building the apps (GitHub Actions, no Mac needed)

The workflow `.github/workflows/native.yml` runs on GitHub's macOS machines, which are free for a public
repository. Run it from the repository's Actions tab: Native apps, Run workflow. A run takes about 12 to 15 minutes.

- `mac`: builds the universal Mac app and uploads `Tempo-mac.zip` and `Tempo-mac.dmg` as a run artifact
  (kept 14 days).
- `ios`: builds the app for the iOS Simulator and runs it on an iPhone and an iPad simulator.
- `smoke`: each app opens its diagnostics page and posts what works inside it (secure context, the engine's
  wasm file, voices played in an audio element, Stockfish, whether the sync service can be reached from the
  app's origin, safe areas) to a listener on the runner. The reports are printed in the job log and saved with
  the screenshots.
- `release` and a tag name: also attach the Mac app to a GitHub release, so a link can be handed out.

## What the first runs showed

Both apps built and ran on `macos-26` runners (real WKWebView, the same web engine as Safari).

| | Mac app (`tauri://localhost`) | iPad simulator (`capacitor://localhost`) |
| --- | --- | --- |
| Build | universal (`x86_64 arm64`), ad-hoc signed (`Signature=adhoc`, no team), `Tempo.app` 157 MiB, `.dmg` 152 MiB, zip 152 MB | builds with `CODE_SIGNING_ALLOWED=NO` for the simulator |
| Secure context, `crypto.subtle`, Cache API, `navigator.share`, clipboard | all present | all present |
| Service worker | the API exists but the app registers none | absent, as expected |
| Stockfish | starts as real Stockfish (not the backup engine), first search in 0.2 to 0.3 s | starts as real Stockfish; about 1 s on the shared CI simulator |
| `stockfish.wasm` file type | `application/wasm` | `application/wasm` |
| Pip's voice clips | fetched; a clip loads and plays in an `<audio>` element. The file server answers a byte-range request with the whole file (200) instead of 206, which did not matter | fetched with a 206 range answer (loading and playing a clip in an audio element is being checked in the second run) |
| Sync service (Supabase) from the app's origin | reachable (HTTP 200) | reachable (HTTP 200, so cross-origin requests from `capacitor://` are allowed) |
| Device (system) English voices | 25 | 25 |
| Safe areas | 0 | top 32 px, bottom 20 px |

Not checked, because they need a real device or a person: the silent switch on a real iPhone or iPad (the
audio session is set natively, see above), haptics, how a person's Mac reacts to the unsigned app, and
anything about signing, notarization and TestFlight.

## Opening the Mac app (unsigned)

Download `Tempo-mac.zip`, unzip it and drag `Tempo.app` to Applications. macOS will not open an app from an
unidentified developer the first time:

1. Try to open it once, then open System Settings, Privacy and Security, scroll down and choose Open Anyway.
2. Or, in Terminal: `xattr -dr com.apple.quarantine /Applications/Tempo.app`, then open it.

A Developer ID certificate from the Apple Developer Program removes the prompt (below).

## Running it on a real iPhone or iPad

An iPhone or iPad only runs an app signed by Apple. There is no way around this, and an unsigned `.ipa` cannot be
installed on any device.

1. Enrol in the Apple Developer Program ($99 a year).
2. In App Store Connect, create the app with the bundle id `io.github.bgage72590.tempo` (or change `appId` in
   `capacitor.config.json` and the bundle identifier in the Xcode project first).
3. Add these as repository secrets in GitHub (Settings, Secrets and variables, Actions). They are for the
   workflow to read; never paste them into a chat or an issue: `APP_STORE_CONNECT_KEY_ID`,
   `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_API_KEY` (the text of the `.p8` key) and, as a variable,
   `APPLE_TEAM_ID`.
4. The workflow then needs a signing and upload job (an archive with `-allowProvisioningUpdates` and the API
   key, an export with an `ExportOptions.plist` of method `app-store-connect`, and an upload to TestFlight).
   That job is not written yet, because it cannot be tested without the account.

The same account also provides a Developer ID certificate for the Mac app. For Tauri, the secrets are
`APPLE_CERTIFICATE` (the `.p12`, base64), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY` and either
`APPLE_API_ISSUER`, `APPLE_API_KEY` and `APPLE_API_KEY_PATH`, or `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID`;
Tauri then signs and notarizes during `tauri build`. Set `bundle.macOS.signingIdentity` accordingly.

An Apple Silicon Mac can also run the iPhone/iPad app once it is in TestFlight or the App Store.

## Before giving the apps to other people

- **Licences.** Stockfish (GPLv3) runs inside the app. Settings, Credits links its source and this repository, which
  is the written source offer. Keep that in any store listing, and decide Tempo's own licence (there is no
  `LICENSE` file yet).
- **Pip's voices** are Google Cloud Text-to-Speech output. Check Google's current terms for redistributing
  generated audio inside an app before a store release, or ship the device voice or a Kokoro voice instead.
- **Privacy.** Sync stores a family's progress under a sync code. A store listing needs a privacy policy.
- **App Store review** may question an app that only wraps a website; this one carries its own files, engine and
  voices, and works offline, which helps.

## Working on it

```sh
npm run build:native                # from the repository root: dist-native/
cd native && npm ci                 # the Tauri and Capacitor tools (kept apart from the web app's install)
npx cap sync ios                    # copy dist-native into the iOS project (macOS: then open ios/App/App.xcodeproj)
npx tauri build --target universal-apple-darwin --bundles app,dmg   # macOS only
node ../scripts/icons/render-icons.cjs && npm run icons             # after changing the icon: native/icons/app-1024.png and the Mac icon set
```

The app id is `io.github.bgage72590.tempo`. Changing it later makes the app a different app to the system: its
saved progress would not carry over.
