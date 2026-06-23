# Deck of Shadows

Solitario a carte in **p5.js** con riconoscimento **QR code** tramite webcam.  
**No click, no tastiera:** l'interazione avviene solo mostrando carte fisiche alla webcam.

## Come testare in locale

La webcam richiede un server HTTP locale.

```bash
cd card-recognition-app
npm run serve
# Apri l'indirizzo mostrato (di solito http://localhost:3000)
```

## Unit test

La logica di gioco è separata dal rendering e testabile in Node.js:

```bash
npm test
```

## Come si gioca

1. **Inizia**: mostra una carta fisica con QR code alla webcam.
2. Il computer mostra un **Nemico** con elemento e potere.
3. **Gioca**: mostra alla webcam una carta della tua mano (quelle disegnate in basso).
4. **Vittoria**: se la tua carta batte il nemico, il nemico entra nel tuo mazzo.
5. **Sconfitta**: se perdi, perdi 1 HP.
6. **Vinci** dopo 8 round. A Game Over, mostra una carta per ricominciare.

Puoi anche usare il QR speciale `RESTART` per riavviare in qualsiasi momento.

## Preparare le carte fisiche

Apri la pagina di stampa integrata:

```bash
npm run serve
# poi apri http://localhost:3000/print.html
```

La pagina genera automaticamente:
- 2 copie di ogni carta base
- 1 carta speciale `RESTART`

Ogni carta include il proprio QR code. Suggerimenti per integrare il QR nel disegno:
- inseriscilo come "sigillo" decorativo in un angolo
- usa colori della carta per i moduli del QR (mantieni contrasto sufficiente)
- usa un QR artistico con immagine al centro

## Audio

I suoni sono generati proceduralmente con la **Web Audio API** (`audio.js`).  
Nessun file audio esterno è richiesto. L'audio si attiva automaticamente al primo QR riconosciuto.

## Animazioni

Durante il combattimento:
- la carta giocata **vola** dal basso verso il nemico
- **particelle** ed esplosione all'impatto
- il nemico **tremà** se colpito
- **flash** di schermo verde/rosso/giallo in base al risultato
- floaters "+ NEMICO" / "-1 HP"

## Struttura

```
card-recognition-app/
├── index.html          # UI di gioco
├── print.html          # Generatore carte/QR stampabili
├── style.css           # Stili
├── cards.js            # Database carte + logica combattimento
├── game.js             # Stato del gioco, testabile
├── audio.js            # Suoni procedurali Web Audio API
├── sketch.js           # Rendering p5.js + webcam + animazioni
├── test/
│   ├── test-cards.js
│   └── test-game.js
├── package.json
└── README.md
```

## Personalizzare

- `cards.js`: modifica elementi, relazioni, template delle carte.
- `game.js`: regole di gioco, HP iniziali, round per vincere, dimensione mano.
- `audio.js`: suoni, frequenze, durate.
- `sketch.js`: solo rendering e animazioni; la logica non va qui.

## Webcam non parte?

1. **Apri la console del browser** (F12 → tab Console) e guarda il messaggio esatto.
2. **Devi usare un server locale**: la webcam non funziona aprendo `index.html` direttamente dal disco.
3. **Concedi il permesso** quando il browser te lo chiede. Se l'hai bloccato, clicca sull'icona 🔒 vicino all'URL e riattiva la fotocamera, poi ricarica con F5.
4. **Browser supportati**: Chrome, Edge, Firefox aggiornati. Safari può richiedere permessi aggiuntivi.
5. **Assicurati che nessun altro programma** (Zoom, Teams, OBS) stia usando la webcam.
6. **localhost o HTTPS**: su HTTP remoto la webcam è bloccata. In locale (`localhost`/`127.0.0.1`) funziona.

## Prossimi passi

- Sottofondo musicale generativo.
- Modalità "hardcore" con nemici più forti.
- Effetti speciali sulle carte (combo, abilità).
- Salvataggio best run in `localStorage`.
