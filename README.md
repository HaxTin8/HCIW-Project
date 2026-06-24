# Deck of Shadows

Solitario a carte in **p5.js** con riconoscimento **QR code** tramite webcam.  
**No click, no tastiera:** l'interazione avviene solo mostrando carte fisiche alla webcam.

## Come testare in locale

La webcam richiede un server HTTP locale.

### Con Node.js

```bash
cd card-recognition-app
npm run serve
# Apri l'indirizzo mostrato (di solito http://localhost:3000)
```

### Con Docker Compose

Se hai Docker e Docker Compose installati:

```bash
cd card-recognition-app
docker compose up --build
# Apri http://localhost:3000
```

Per fermare:

```bash
docker compose down
```

## Unit test

La logica di gioco è separata dal rendering e testabile in Node.js:

```bash
npm test
```

## Come si gioca

1. **Le tue carte sono solo fisiche**: stampale da `print.html` e tienile davanti a te. Il computer non mostra mai le carte che hai.
2. **Inizia**: mostra una carta fisica con QR code alla webcam.
3. Ogni round il computer presenta **3 nemici** (configurabile), uno alla volta.
4. Il computer annuncia il nemico corrente con elemento e potere.
5. **Slot carta**: mostra alla webcam la carta che vuoi giocare contro il nemico corrente. La carta viene caricata nello **slot** centrale.
6. **Gioca la carta**: togli la carta dalla webcam (slot vuoto). Il computer risolve lo scontro.
7. Affronta tutti e 3 i nemici del round.
8. **Vittoria del round**: se vinci più scontri di quanti ne perdi, aggiungi i nemici al tuo mazzo fisico.
9. **Sconfitta del round**: se perdi più scontri di quanti ne vinci, perdi 1 HP.
10. **Vinci** dopo 8 round. A Game Over, mostra una carta per ricominciare.

Il meccanismo dello slot evita letture doppie: una carta viene giocata una sola volta, solo dopo essere stata rimossa dalla webcam.

### Modalità di gioco

Puoi cambiare modalità in qualsiasi momento mostrando alla webcam i QR speciali:

- **`SEQUENZIALE`** (default): gioca una carta alla volta con il meccanismo dello slot.
- **`SIMULTANEO`**: hai **8 secondi** per mostrare tutte le carte che vuoi giocare. Quando il tempo scade, il computer gioca automaticamente tutte le carte lette in sequenza contro i nemici del round.

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
├── tts.js              # Sintesi vocale (Text-to-Speech)
├── sketch.js           # Rendering p5.js + webcam + animazioni
├── test/
│   ├── test-cards.js
│   └── test-game.js
├── package.json
├── Dockerfile
├── docker-compose.yml
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
