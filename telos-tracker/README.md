# Telos Rotation Tracker

A first-test Alt1 Toolkit app for Telos, the Warden.

## What this version does

- Encodes the supplied P1-P5 rotation graph and carry-over rules.
- Shows the predicted next mechanic and number of auto attacks remaining.
- Allows manual mechanic confirmation and manual auto counting.
- Includes an experimental Alt1 chat OCR mode for Tendrils, Uppercut and Hold Still.
- Includes an opt-in experimental hit-splat detector calibrated around the player's cursor.
- Keeps all state local; no account, API key or game credentials are used.

## Important

The rotation graph is the source of truth for prediction. Chat OCR and hit-splat detection are assistance layers. During the first testing sessions, use the manual buttons whenever the detector is uncertain.

## Test locally

Any static HTTP server works. For example:

```bash
python -m http.server 8090 -d src
```

Then open `http://localhost:8090` in a browser for UI testing.

## Install in Alt1

Host the `src` folder on a static HTTPS host and point Alt1 at `appconfig.json`:

```text
alt1://addapp/https://YOUR-HOST/telos-tracker/appconfig.json
```

GitHub Pages is a good free host. Alt1 apps are webpages running in the Alt1 browser and can request screen/game/overlay permissions. See the official Alt1 developer guidance and examples.

## First in-game test

1. Run RuneScape 3 and Alt1 Toolkit.
2. Add this app and allow Pixel, Game State and Overlay permissions.
3. Start the tracker before Telos.
4. For the first test, use the manual mechanic buttons to verify the rotation graph.
5. Click `Start chat OCR` and check that Tendrils / Uppercut / Hold Still are detected from their chat messages.
6. For hit-splats, put the mouse over your character and click `Set hit area from cursor`.
7. If the detector misses, use `+1 auto`; this gives us useful information for improving the detector.

## Next development steps

- Replace the grid-based chat OCR fallback with the current `@alt1/chatbox` reader.
- Add reliable phase-screen-message recognition once a screenshot of the Telos phase notification is available.
- Calibrate hit-splat colours/shape from real Telos screenshots at the user's game scaling.
- Add explicit phase-transition/carry-over state so phasing at any point in a cycle automatically selects the correct next mechanic.
- Add optional audio/overlay warnings such as `NEXT: VIRUS` and `2 AUTOS`.
