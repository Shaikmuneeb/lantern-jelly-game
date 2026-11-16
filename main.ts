// Lumen Drift hands itself in. The game is this repository's game/ folder — plain static
// files a desktop browser plays offline — and screenshots/ are four photographs of it.
// This program copies both from beside this file to the output directory and writes
// dossier.json there: the Game block and source text the judge reads, built with the
// kit's vendored library, vendor/makefun-game.ts, unmodified.
//
// The grader runs it twice in a row and requires both runs to write identical bytes, so
// it copies what is there and never writes a clock, a random value or a path of its own.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Serve the game for play-testing with `node serve.ts`, then open http://localhost:8080.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

// The playable game and its screenshots travel as they are.
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (its reference/gate.json). Only text_max_bytes shapes the bytes
// this writes; the others refuse here what the scorer would refuse there — more than
// four screenshots or one over 256 KiB, game/ past 993 entries or 48 MiB of files, a
// game/ path over 1,000 bytes — so a mistake fails with this message, not a sealed one.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
