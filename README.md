# lantern-jelly-game

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Shaikmuneeb/lantern-jelly-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Shaikmuneeb/lantern-jelly-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Lumen Drift** is a deep-sea arcade survival game: you are a lantern jelly holding back the darkness of an abyss, fighting eight escalating waves of creatures, gathering plankton that gifts you one of three upgrades at every level, and ending the dive against the Abyssal Maw itself. Vanilla JavaScript and the Canvas API only — no libraries, no build step, no network requests; it plays offline straight from `game/index.html` in desktop Chrome.

## Run it

```sh
node serve.ts          # play at http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # hand the game in (writes out/dossier.json)
```

## The game

- **Goal** — survive waves 1 through 7, then destroy the Abyssal Maw on wave 8. Lose when your last light of five goes out.
- **Controls** — WASD or arrows to swim, mouse (or space) to fire light pulses, shift to dash with brief invulnerability, P to pause, M to mute, R to restart from an ending screen.
- **Feedback** — HUD with light droplets, dash meter, score and best, wave counter, boss health bar, experience bar and earned-upgrade chips; floating score numbers, hit flashes, particles, wave banners and a chain-combo multiplier.
- **Depth** — eleven stacking upgrades (rapid fire, extra shards, pierce, chain arcs, thorn halo, ravaging dash and more), four enemy types with distinct behaviour (seekers, telegraphed chargers, tanks, ranged spitters), a three-state boss, pearls that heal, and a combo window that rewards aggressive play.

## Project layout

| Path | Job |
| --- | --- |
| `main.ts` | hands the entry in: copies `game/` + `screenshots/`, writes `dossier.json` |
| `serve.ts` | static file server for play-testing |
| `game/src/main.js` | fixed-step loop and game-state machine (title → play → level-up → win/loss) |
| `game/src/config.js` | every balance number, wave script, palette and upgrade definition |
| `game/src/player.js` | the lantern jelly: drift, dash, light, halo |
| `game/src/weapons.js` | light pulses, piercing, chain arcs |
| `game/src/enemies.js` | the swarm's four behaviours and the damage/death path |
| `game/src/boss.js` | the Abyssal Maw: charges, volleys, summons, enrage |
| `game/src/director.js` | wave pacing, spawn schedules, banners, clear bonuses |
| `game/src/pickups.js` | plankton and pearls, magnet collection |
| `game/src/upgrades.js` | experience, level-ups, the pick-one-of-three cards |
| `game/src/hud.js` | all in-fight HUD readouts |
| `game/src/screens.js` | title, pause, victory and defeat screens |
| `game/src/shots.js` | deterministic `?shot=` scenes used to take the screenshots |
| `game/src/audio.js` | procedural WebAudio sound (no audio files) |
| `game/src/background.js` | the abyss: gradient, light shafts, kelp, drifting motes |
| `game/src/particles.js` | pooled sparks, rings and floating text |

## Screenshots

`screenshots/` holds four real renders of the game itself at a 1280×720 viewport, produced by the game's own `?shot=<scene>&seed=<n>` modes (`shots.json` lists them): the title screen, combat mid-wave with the full HUD, a level-up gift choice, and the victory screen with its run summary and restart.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
