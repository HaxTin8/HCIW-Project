# Deck of Shadows

Solitario a carte in **p5.js** con riconoscimento **QR code** tramite webcam.  
**No click, no tastiera:** l'interazione avviene solo mostrando carte fisiche alla webcam.

## Come testare in locale

La webcam richiede un server HTTP locale.

## Storie Twine

Le storie ora hanno una distinzione chiara tra:

- `stories/twine/`: sorgenti versionati in formato **Twee**. Questa e' la fonte di verita' per chi scrive la narrativa.
- `stories/generated/`: JSON runtime generati automaticamente e non versionati.

Il gioco legge solo i file generati, ma chi sviluppa modifica i file `.twee`.

### Flusso di lavoro

1. Modifica una storia in `stories/twine/*.twee`.
2. Rigenera i JSON con:

```bash
npm run build:stories
```

3. Avvia il progetto con:

```bash
npm run serve
```

`npm run serve` esegue gia' la build delle storie prima di servire i file.

### Struttura di una storia `.twee`

Ogni file contiene almeno:

- `:: StoryTitle` con il titolo leggibile.
- `:: StoryData` con metadata JSON (`id`, `author`, `startPassage`).
- i passaggi narrativi normali, con link Twine come `[[Continua->prossimo-passaggio]]`.

Per gli effetti di gioco puoi aggiungere un blocco:

```text
<blocco gameEffects>
{
  "roundSpecific": 3,
  "drawCountsAsWin": true
}
</blocco gameEffects>
```

Nel file reale il blocco usa fence Markdown, ad esempio:

    ```gameEffects
    {
      "roundSpecific": 3,
      "drawCountsAsWin": true
    }
    ```

Durante il deploy Docker, la build delle storie viene eseguita automaticamente dentro l'immagine. In repository restano quindi come sorgente autorevole i file Twine/Twee.

## TTS con Piper

Piper viene eseguito come **servizio separato nello stesso `docker-compose`**.

Questo approccio e' preferibile rispetto a metterlo dentro il container nginx dell'app, perche':

- il sito resta un servizio statico semplice da servire
- il TTS ha il suo ciclo di vita, cache e log
- Dokploy puo' riavviare o aggiornare Piper senza toccare il frontend

L'app pubblica espone Piper tramite reverse proxy su:

```text
/api/tts/
```

Il container Piper usa l'HTTP server ufficiale del progetto.

Nel frontend puoi scegliere:

- `Automatico`: prova prima Piper, poi ricade sulle voci del browser
- `Piper server`: forza il backend TTS, con fallback browser se il servizio non risponde
- `Browser`: usa direttamente la Web Speech API locale

Le voci di `gameplay` e `story` restano separate anche con Piper.

### Configurazione voci

Nel `docker-compose.yml` puoi impostare:

```env
PIPER_VOICES=it_IT-riccardo-x_low,it_IT-paola-medium
PIPER_DEFAULT_VOICE=it_IT-paola-medium
```

Per il primo bootstrap puoi anche lasciare la voce di default `en_US-lessac-medium`, che e' l'esempio documentato ufficialmente da Piper.

Se vuoi che il gioco parta subito in italiano, conviene impostare almeno una o due voci `it_IT`.

### Endpoint utili

- `GET /api/tts/voices`
- `GET /api/tts/info`
- `POST /api/tts/synthesize`

Esempio:

```bash
curl -X POST http://localhost/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Ciao! Questa e una prova."}' \
  --output prova.wav
```

### Con Node.js

```bash
npm run serve
# Apri l'indirizzo mostrato (di solito http://localhost:3000)
```

### Con Docker Compose

Se hai Docker e Docker Compose installati:

```bash
docker compose up --build
# Apri http://localhost
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
3. Il computer annuncia i nemici del round.
4. **Slot carte**: mostra alla webcam le carte che vuoi giocare. Ogni carta va nel primo slot libero.
5. **Gioca**: quando tutti gli slot sono pieni, il computer risolve tutti gli scontri insieme.
6. **Vittoria del round**: se vinci più scontri di quanti ne perdi, prendi i nemici.
7. **Sconfitta del round**: se perdi più scontri di quanti ne vinci, perdi 1 HP.
8. **Vinci** dopo 8 round. A Game Over, mostra una carta per ricominciare.

### Modalità di gioco

Puoi cambiare modalità in qualsiasi momento mostrando alla webcam i QR speciali (stampati in `print.html`):

- **`SEQUENZIALE`** (default): 1 nemico e 1 slot per round.
- **`SIMULTANEO`**: 3 nemici e 3 slot per round. Carichi 3 carte una alla volta, poi lo scontro avviene tutto insieme.

Puoi anche usare il QR speciale `RESTART` per riavviare.

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
/
├── index.html          # UI di gioco
├── print.html          # Generatore carte/QR stampabili
├── style.css           # Stili
├── cards.js            # Database carte + logica combattimento
├── game.js             # Stato del gioco, testabile
├── audio.js            # Suoni procedurali Web Audio API
├── tts.js              # Sintesi vocale (Text-to-Speech)
├── sketch.js           # Rendering p5.js + webcam + animazioni
├── scripts/
│   └── build-stories.js
├── stories/
│   ├── twine/          # Sorgenti Twee versionati
│   └── generated/      # JSON runtime generati
├── test/
│   ├── test-cards.js
│   ├── test-game.js
│   └── test-stories-build.js
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Personalizzare

### Deploy con Dokploy

Per Dokploy non serve una seconda app separata: basta fare deploy di questo stesso repository con il suo `docker-compose.yml`.

Controlli consigliati:

1. Assicurati che Dokploy usi `docker compose up --build` sul repository aggiornato.
2. Imposta, se vuoi l'italiano subito disponibile:

```env
PIPER_VOICES=it_IT-riccardo-x_low,it_IT-paola-medium
PIPER_DEFAULT_VOICE=it_IT-paola-medium
```

3. Verifica che il servizio esponga la porta HTTP dell'app, cioe' `80`.
4. Al primo avvio Piper scarichera' i modelli vocali: il bootstrap iniziale puo' durare un po' piu' del solito.
5. Il server deve poter uscire su Internet al primo avvio del container `piper-tts`, cosi' i modelli vocali possono essere scaricati.

Se non imposti variabili, il deploy parte comunque, ma con la voce di esempio `en_US-lessac-medium`.

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
