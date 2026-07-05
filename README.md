# Specula Elementae

A tangible card game for children, conceived as a hybrid playful system in which physical cards remain central to the experience while the computer operates as a supporting game master. It adopts a no-WIMP interaction paradigm with card-based, webcam input via QR codes.

Built with **p5.js** and **Vite**.

## How to test locally

The webcam requires a local HTTP server. The recommended development flow uses **Vite** for the frontend and a lightweight Node server for APIs and storage.

Use the following commands:

```bash
npm install
npm run dev
```

This starts:

* the Vite frontend at `http://localhost:5173`
* the backend API at `http://localhost:3000`

The client uses **native ESM**: Vite handles HMR for the frontend and multi-page builds for `index.html`, `family-voice.html`, and `print.html`.

```bash
npm run debug
```

This starts the game with frontend debug already enabled via `VITE_ENABLE_DEBUG=1`, so you can simulate cards from buttons without QR codes and without the webcam.

## How to play

1. **Your cards are physical only**: print them from `print.html` and keep them in front of you. The computer never shows the cards you have.
2. **Start**: show a physical card with a QR code to the webcam.
3. The computer announces the enemies for the round.
4. **Card slot**: show the card you want to play to the webcam.
5. **Play**: remove the card or wait a moment to start the clash.
6. **Round victory**: if your card beats the enemy, you pass the challenge.
7. **Round defeat**: if your card loses against the enemy, you lose 1 HP.
8. **Win** after 8 rounds. At Game Over, show a card to restart.

You can also use the special `RESTART` QR code to restart.

## Preparing the physical cards

Open the integrated print page:

`http://localhost:3000/print.html`

The page automatically generates:

* 2 copies of each base card
* 1 special `RESTART` card

Each card includes its own QR code.

## Family Voices

The game includes a **Family Voices** section in the main interface.

Flow:

1. A parent creates a simple profile with `username` and `password`.
2. The server generates a `bearer token` and saves the data in SQLite.
3. The teleprompter shows gameplay prompts and Twine story passages.
4. Each prompt can be recorded, played back, or deleted.
5. Recordings remain private to that user and cannot be accessed by other profiles.

When a recording exists for a prompt, the game uses it first. If there is no clip, it continues to use Piper or browser voices as a fallback.

## Twine Stories

Stories are written in the `stories/twine/` directory, which contains versioned source files in **Twee** format.
This directory is the source of truth for writing narrative content.

The game includes a script that generates the runtime files read by the game. This script runs every time the game starts.

### Workflow

1. Edit a story in `stories/twine/*.twee`.
2. Regenerate the JSON files with:

```bash
npm run build:stories
```

### Structure of a `.twee` story

Each file contains at least:

* `:: StoryTitle` with the readable title.
* `:: StoryData` with JSON metadata: `id`, `author`, `startPassage`.
* normal narrative passages, with Twine links such as `[[Continue->next-passage]]`.

For gameplay effects, you can add a block:

```text
<blocco gameEffects>
{
  "roundSpecific": 3,
  "drawCountsAsWin": true
}
</blocco gameEffects>
```

In the real file, the block uses Markdown fences, for example:

````text
```gameEffects
{
  "roundSpecific": 3,
  "drawCountsAsWin": true
}
```
````

During Docker deployment, the story build is executed automatically inside the image. The Twine/Twee files therefore remain the authoritative source in the repository.

## TTS with Piper

Piper runs as a **separate service inside the same `docker-compose`**.

The public app exposes Piper through a reverse proxy at:

```text
/api/tts/
```

The Piper container uses the project’s official HTTP server.

In the frontend, you can choose:

* `Automatic`: tries Piper first, then falls back to browser voices
* `Piper server`: forces backend TTS, with browser fallback if the service does not respond
* `Browser`: directly uses the local Web Speech API

The `gameplay` and `story` voices remain separate even with Piper.

### Voice configuration

In `docker-compose.yml`, you can set:

```env
PIPER_VOICES=it_IT-riccardo-x_low,it_IT-paola-medium
PIPER_DEFAULT_VOICE=it_IT-paola-medium
```

For the first bootstrap, you can also leave the default voice as `en_US-lessac-medium`, which is the example officially documented by Piper.

If you want the game to start immediately in Italian, it is best to set at least one or two `it_IT` voices.

## Unit tests

The game logic is separated from rendering and can be tested in Node.js:

```bash
npm test
```

## Structure

```text
/
├── index.html          # Game UI
├── print.html          # Printable card/QR generator
├── style.css           # Styles
├── cards.js            # Card database + combat logic
├── game.js             # Game state, testable
├── audio.js            # Procedural Web Audio API sounds
├── family-voice.js     # Family recording UI + auth client
├── tts.js              # Voice synthesis with fallback to family recordings
├── sketch.js           # p5.js rendering + webcam + animations
├── scripts/
│   ├── build-stories.js
│   └── dev-server.js
├── server/
│   ├── app-server.js   # Lightweight server: static files, auth, audio upload, Piper proxy
│   ├── auth-store.js   # SQLite + token + recording metadata
│   └── prompt-catalog.js
├── stories/
│   ├── twine/          # Versioned Twee sources
│   └── generated/      # Generated runtime JSON files
├── test/
│   ├── test-auth-store.js
│   ├── test-cards.js
│   ├── test-game.js
│   ├── test-prompt-catalog.js
│   └── test-stories-build.js
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```
