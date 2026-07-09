export const DEFAULT_LOCALE = "it";
export const SUPPORTED_LOCALES = ["en","it"];
export const LOCALES = {
  "en": {
    "meta": {
      "locale": "en",
      "label": "English"
    },
    "languages": {
      "it": "Italian",
      "en": "English"
    },
    "app": {
      "title": "Specula Elementae"
    },
    "ui": {
      "languageLabel": "Language",
      "languageOption": "{label}"
    },
    "gamePage": {
      "title": "Specula Elementae",
      "settingsAria": "Settings",
      "privacyAria": "Webcam privacy information",
      "debugAria": "Open quick debug",
      "printAria": "Open card printing page",
      "privacyTitle": "Webcam privacy",
      "privacyBody": "The camera is only used in the browser to recognize cards. No video is sent to servers.",
      "debugKicker": "Tools",
      "debugTitle": "Quick Debug",
      "debugCloseAria": "Close debug",
      "debugNote": "Simulate QR codes without physical cards or a webcam. The panel only appears when debug is enabled in the environment.",
      "cameraActivate": "Enable camera",
      "cameraSwitch": "Switch camera",
      "cameraSettingsKicker": "Camera",
      "cameraSettingsTitle": "Webcam controls",
      "fullscreenEnter": "Full screen",
      "fullscreenExit": "Exit full screen",
      "settingsKicker": "Advanced options",
      "settingsTitle": "Settings",
      "settingsCloseAria": "Close settings",
      "ttsEnabled": "Guide voice enabled",
      "ttsProviderLabel": "Voice engine",
      "ttsProviderAuto": "Automatic",
      "ttsProviderPiper": "Piper server",
      "ttsProviderBrowser": "Browser",
      "ttsProviderChecking": "Checking voice engine...",
      "ttsGameplayLabel": "Guide voice",
      "ttsStoryLabel": "Narrator voice",
      "ttsRepeat": "Repeat last message",
      "familyVoiceTitle": "Family Voice Studio",
      "familyVoiceBody": "To record or play a family voice, first sign in to the dedicated studio.",
      "familyVoiceStatus": "Checking access...",
      "familyVoiceLink": "Sign in to use the voice"
    },
    "familyVoicePage": {
      "title": "Specula Elementae - Family Voice Studio",
      "heading": "Family Voice Studio",
      "intro": "Record hints and stories with a familiar voice using the canvas teleprompter and a simple recording flow.",
      "badgePrivate": "Private voice",
      "badgeTeleprompter": "Guided teleprompter",
      "badgeKids": "Great for children",
      "backToGame": "Back to game",
      "profileRibbon": "Family profile",
      "profileTitle": "Studio profile",
      "profileBody": "Sign in, choose the prompt type, and record a clear and reassuring clip for the child.",
      "useRecordings": "Use recordings",
      "loginHint": "Sign in or create a profile to save private recordings.",
      "username": "Username",
      "usernamePlaceholder": "parent",
      "password": "Password",
      "passwordPlaceholder": "simple password",
      "createProfile": "Create profile",
      "login": "Sign in",
      "teleprompterKicker": "Teleprompter",
      "teleprompterTitle": "Guided recording",
      "teleprompterBody": "Read calmly, follow the suggested pacing, and save a voice the child recognizes immediately.",
      "refresh": "Refresh prompts",
      "logout": "Sign out",
      "filterAll": "All",
      "filterGameplay": "Hints",
      "filterStory": "Stories",
      "counter": "{completed} of {total} completed",
      "prevPrompt": "Previous prompt",
      "currentPrompt": "Current prompt",
      "noFilter": "No active filter",
      "nextPrompt": "Next prompt",
      "promptLabel": "Prompt",
      "promptPlaceholder": "Select a text",
      "durationLabel": "Recommended duration",
      "studioHint": "Choose a prompt from the library to start recording in the studio.",
      "studioReady": "Ready to record",
      "record": "Start recording",
      "play": "Play clip",
      "delete": "Delete clip"
    },
    "familyVoice": {
      "sessionExpired": "Session expired. Please sign in again.",
      "profileCreated": "Profile created. You can now record voices.",
      "loginDone": "Signed in. Voice library ready.",
      "logoutDone": "Session ended.",
      "loadingTeleprompter": "Loading teleprompter...",
      "missingCredentials": "Enter username and password.",
      "idleCanvas": "Choose a prompt from the library to begin",
      "canvasLabel": "FAMILY VOICE",
      "recordUnsupported": "Audio recording is not supported by this browser.",
      "recording": "Recording in progress...",
      "emptyRecording": "Empty recording, please try again.",
      "recordingSaved": "Recording saved.",
      "recordingDeleted": "Recording deleted.",
      "profileActive": "Active profile: {username}",
      "summaryCompleted": "{completed}/{total} completed",
      "summaryFilterStory": "Filter: stories",
      "summaryFilterGameplay": "Filter: hints",
      "summaryFilterAll": "Filter: all",
      "summaryBody": "Prompts are recorded from the central teleprompter. Use the buttons above the canvas to move to the next or previous text.",
      "selectPrompt": "Select a prompt",
      "copyHint": "Read in a calm, natural voice. The text highlights following the suggested pacing for this line.",
      "copyEmpty": "Choose a prompt to begin.",
      "stateRecording": "Recording in progress",
      "stateReady": "Ready to record",
      "stateEmpty": "No prompt selected",
      "recordStop": "Stop and save",
      "recordStart": "Start recording",
      "errors": {
        "username_taken": "This username already exists.",
        "unauthorized": "Incorrect username or password.",
        "username_password_required": "Username and password are required.",
        "invalid_prompt_id": "Invalid prompt.",
        "empty_audio": "The recording is empty.",
        "payload_too_large": "Audio file is too large.",
        "NotAllowedError": "Microphone permission denied.",
        "NotFoundError": "No microphone available."
      }
    },
    "tts": {
      "guideVoice": "Guide voice",
      "storyVoice": "Narrator voice",
      "providerUnavailable": "Speech synthesis is not available.",
      "providerPiper": "Active provider: Piper server.",
      "providerBrowser": "Active provider: browser voices.",
      "providerBrowserFallback": "Piper is unreachable, using browser voices.",
      "providerPiperFallback": "Browser voices unavailable, falling back to Piper.",
      "autoServer": "Automatic (server)",
      "autoBrowser": "Automatic (browser)"
    },
    "cards": {
      "elements": {
        "FIRE": {
          "name": "Ember"
        },
        "WATER": {
          "name": "Droplet"
        },
        "NATURE": {
          "name": "Sprout"
        },
        "LIGHT": {
          "name": "Ray"
        },
        "SHADOW": {
          "name": "Eclipse"
        },
        "THUNDER": {
          "name": "Bolt"
        }
      },
      "templates": {
        "ROSSO": {
          "name": "Ember",
          "description": "Ember warms and brings light, but it must be used carefully."
        },
        "BLU": {
          "name": "Droplet",
          "description": "Droplet helps plants grow, but it works best when used calmly."
        },
        "VERDE": {
          "name": "Sprout",
          "description": "Sprout grows strong, but only with plenty of patience."
        },
        "GIALLO": {
          "name": "Ray",
          "description": "Ray lights the path, but it dazzles anyone who stares too long."
        },
        "VIOLA": {
          "name": "Eclipse",
          "description": "Eclipse makes you pause and observe, but staying too long in the shadows can make you lose your way."
        },
        "NERO": {
          "name": "Bolt",
          "description": "Bolt arrives fast and strong, but using it without thinking can lead to losing control."
        }
      }
    },
    "game": {
      "startAdventure": "The adventure begins.",
      "startingCard": "Starting card: {cardId}.",
      "winCombat": "{player} defeats {enemy}.",
      "loseCombat": "{player} loses against {enemy}.",
      "drawCombat": "{player} draws with {enemy}.",
      "victory": "You completed the adventure!",
      "gameOver": "The adventure ends here, but you can try again.",
      "resume": "Here we go again.",
      "unknownCard": "Unknown card: {id}."
    },
    "sketch": {
      "webcamPreparing": "Preparing the camera...",
      "webcamChanging": "Switching camera...",
      "webcamUnsupported": "This browser does not support the camera well. Try Chrome, Edge, or Safari.",
      "webcamRequestingPermission": "Requesting permission to use the camera...",
      "webcamActive": "Camera active.",
      "webcamActiveStatus": "Camera active. Show a card to start your adventure.",
      "webcamAttempt": "Camera attempt {attempt}/3...",
      "webcamRetry": "I can't enable the camera. Tap the button to try again.",
      "webcamNotFound": "I can't find a camera. Connect one and reload.",
      "webcamNotWorking": "I couldn't find a working camera.",
      "webcamSearchError": "There was a problem while searching for cameras.",
      "showCard": "Show a card to the webcam to start your adventure.",
      "introSubtitle": "An elemental solitaire guided by the magic of your webcam.",
      "introPrompt": "Show a card to the webcam to begin",
      "providerAuto": "Automatic",
      "providerPiper": "Piper server",
      "providerBrowser": "Browser",
      "statusUnknown": "Speech synthesis is not available.",
      "voiceLabelAutoServer": "Automatic (server)",
      "voiceLabelAutoBrowser": "Automatic (browser)",
      "storyLoadError": "Story loading error",
      "adventureStarted": "Adventure started.",
      "adventureRestarted": "New adventure.",
      "storyEvent": "Enemy cards: {cards}",
      "cardInSlot": "{card} in slot. {line}",
      "cardInSingleSlot": "{line} Remove the card.",
      "modeSimultaneous": "Multi-challenge mode.",
      "modeSequential": "One card at a time mode.",
      "unrecognizedCard": "I don't recognize this card: {id}.",
      "listening": "Listening...",
      "roundWon": "ROUND WON!",
      "roundLost": "ROUND LOST",
      "roundDraw": "DRAW",
      "roundWonBody": "You passed the challenge.",
      "roundLostBody": "You lose one heart, but you can learn from this round.",
      "roundDrawBody": "Look more carefully at the elements for the next turn.",
      "gameOverTitle": "ADVENTURE OVER",
      "gameOverSubtitle": "Show a card to restart.",
      "victoryTitle": "WELL DONE!",
      "victorySubtitle": "Show a card for a new adventure.",
      "hearts": "Hearts:",
      "roundCounter": "Round: {current}/{total}",
      "enemyCounter": "Enemy card: {current}/{total}",
      "enemyHint": "Hint: against {enemy}, try {choices}.",
      "webcamLabel": "Webcam",
      "webcamPermissionHint": "Grant permission and press F5 to reload.",
      "howToPlay": "HOW TO PLAY",
      "howToPlayLines": [
        "Your cards are physical.",
        "Show them to the webcam to play them.",
        "The computer reads and speaks.",
        "If you win, you advance on the map.",
        "If you lose, -1 HP.",
        "Win after 8 rounds."
      ],
      "statusLabel": "STATUS",
      "guideVoiceEnabled": "Guide voice enabled.",
      "guideVoiceDisabled": "Guide voice disabled.",
      "guideVoiceUpdated": "Guide voice updated.",
      "storyVoiceUpdated": "Narrator voice updated.",
      "debugEnabled": "Debug mode active: use the quick buttons to simulate QR codes.",
      "familyVoiceAccessActive": "Access active. Family recordings can be used by the game when available.",
      "openStudio": "Open studio",
      "playerCardSlot": "Your\ncard"
    },
    "promptCatalog": {
      "groupGameplayTitle": "Gameplay lines",
      "groupGameplayDescription": "Core gameplay prompts that can use family voices.",
      "titleGameStart": "Adventure start",
      "titleModeSequential": "One card at a time mode",
      "titleModeSimultaneous": "Multi-challenge mode",
      "titleCardSlot": "{name} in slot",
      "titleCardSingle": "{name} in single slot",
      "titleEnemy": "{name} enemy",
      "storyGroupDescription": "Story passages for {title}"
    },
    "printPage": {
      "title": "Specula Elementae - Printable cards",
      "heading": "Printable cards",
      "intro": "Each card includes its own QR code. Use them with {app}.",
      "tip": "Tip: print on thick paper or laminate the cards.",
      "playModesTitle": "Two ways to play",
      "playModeFreeTitle": "Free mode:",
      "playModeFreeBody": "all 6 cards are always available, so the game is more immediate and better suited to younger children.",
      "playModeDeckTitle": "Deck mode:",
      "playModeDeckBody": "prepare a deck with multiple copies of the 6 cards, draw 5 cards at the beginning, then keep drawing during the match. This makes the game more challenging and strategic.",
      "backToGame": "Back to game",
      "printButton": "Print",
      "restartName": "Restart",
      "restartDescription": "Restart the game.",
      "beatsSingle": "beats",
      "beatsPlural": "beat"
    }
  },
  "it": {
    "meta": {
      "locale": "it",
      "label": "Italiano"
    },
    "languages": {
      "it": "Italiano",
      "en": "English"
    },
    "app": {
      "title": "Specula Elementae"
    },
    "ui": {
      "languageLabel": "Lingua",
      "languageOption": "{label}"
    },
    "gamePage": {
      "title": "Specula Elementae",
      "settingsAria": "Impostazioni",
      "privacyAria": "Informazioni privacy webcam",
      "debugAria": "Apri debug rapido",
      "printAria": "Apri pagina di stampa carte",
      "privacyTitle": "Privacy webcam",
      "privacyBody": "La fotocamera serve solo al riconoscimento delle carte nel browser. Nessun video viene inviato ai server.",
      "debugKicker": "Strumenti",
      "debugTitle": "Debug Rapido",
      "debugCloseAria": "Chiudi debug",
      "debugNote": "Simula i QR code senza usare carte fisiche o webcam. Il pannello compare solo quando il debug e' abilitato nell'ambiente.",
      "cameraActivate": "Attiva la fotocamera",
      "cameraSwitch": "Cambia fotocamera",
      "cameraSettingsKicker": "Fotocamera",
      "cameraSettingsTitle": "Controlli webcam",
      "fullscreenEnter": "Schermo intero",
      "fullscreenExit": "Esci da schermo intero",
      "settingsKicker": "Opzioni avanzate",
      "settingsTitle": "Impostazioni",
      "settingsCloseAria": "Chiudi impostazioni",
      "ttsEnabled": "Voce guida attiva",
      "ttsProviderLabel": "Motore voce",
      "ttsProviderAuto": "Automatico",
      "ttsProviderPiper": "Piper server",
      "ttsProviderBrowser": "Browser",
      "ttsProviderChecking": "Controllo del motore voce in corso...",
      "ttsGameplayLabel": "Voce guida",
      "ttsStoryLabel": "Voce narratore",
      "ttsRepeat": "Ripeti ultimo messaggio",
      "familyVoiceTitle": "Studio Voci di Famiglia",
      "familyVoiceBody": "Per registrare o richiamare una voce familiare serve prima l'accesso allo studio dedicato.",
      "familyVoiceStatus": "Controllo accesso in corso...",
      "familyVoiceLink": "Accedi per usare la voce"
    },
    "familyVoicePage": {
      "title": "Specula Elementae - Studio Voci di Famiglia",
      "heading": "Studio Voci di Famiglia",
      "intro": "Registra indicazioni e storie con una voce familiare, usando il teleprompter su canvas e una scaletta semplice da seguire.",
      "badgePrivate": "Voce privata",
      "badgeTeleprompter": "Teleprompter guidato",
      "badgeKids": "Perfetto per bambini",
      "backToGame": "Torna al gioco",
      "profileRibbon": "Profilo famiglia",
      "profileTitle": "Profilo Studio",
      "profileBody": "Accedi, scegli il tipo di prompt e registra una clip chiara e rassicurante per il bambino.",
      "useRecordings": "Usa registrazioni",
      "loginHint": "Accedi o crea un profilo per salvare registrazioni private.",
      "username": "Username",
      "usernamePlaceholder": "genitore",
      "password": "Password",
      "passwordPlaceholder": "password semplice",
      "createProfile": "Crea profilo",
      "login": "Accedi",
      "teleprompterKicker": "Teleprompter",
      "teleprompterTitle": "Registrazione guidata",
      "teleprompterBody": "Leggi con calma, segui il ritmo consigliato e salva una voce che il bambino riconosce subito.",
      "refresh": "Aggiorna prompt",
      "logout": "Esci",
      "filterAll": "Tutti",
      "filterGameplay": "Suggerimenti",
      "filterStory": "Storie",
      "counter": "{completed} di {total} completati",
      "prevPrompt": "Prompt precedente",
      "currentPrompt": "Prompt attuale",
      "noFilter": "Nessun filtro attivo",
      "nextPrompt": "Prompt successivo",
      "promptLabel": "Prompt",
      "promptPlaceholder": "Seleziona un testo",
      "durationLabel": "Durata consigliata",
      "studioHint": "Scegli un prompt dalla libreria per iniziare a registrare nello studio.",
      "studioReady": "Pronto a registrare",
      "record": "Inizia registrazione",
      "play": "Riascolta clip",
      "delete": "Elimina clip"
    },
    "familyVoice": {
      "sessionExpired": "Sessione scaduta. Fai di nuovo login.",
      "profileCreated": "Profilo creato. Ora puoi registrare le voci.",
      "loginDone": "Login eseguito. Libreria vocale pronta.",
      "logoutDone": "Sessione terminata.",
      "loadingTeleprompter": "Sto caricando il teleprompter...",
      "missingCredentials": "Inserisci username e password.",
      "idleCanvas": "Scegli un prompt dalla libreria per iniziare",
      "canvasLabel": "VOCE DI FAMIGLIA",
      "recordUnsupported": "Registrazione audio non supportata da questo browser.",
      "recording": "Registrazione in corso...",
      "emptyRecording": "Registrazione vuota, riprova.",
      "recordingSaved": "Registrazione salvata.",
      "recordingDeleted": "Registrazione eliminata.",
      "profileActive": "Profilo attivo: {username}",
      "summaryCompleted": "{completed}/{total} completati",
      "summaryFilterStory": "Filtro: storie",
      "summaryFilterGameplay": "Filtro: suggerimenti",
      "summaryFilterAll": "Filtro: tutti",
      "summaryBody": "I prompt si registrano dal teleprompter centrale. Usa i pulsanti sopra la canvas per passare al testo successivo o precedente.",
      "selectPrompt": "Seleziona un prompt",
      "copyHint": "Leggi con voce calma e naturale. Il testo si illumina seguendo il ritmo consigliato per questa frase.",
      "copyEmpty": "Scegli un prompt per iniziare.",
      "stateRecording": "Registrazione in corso",
      "stateReady": "Pronto a registrare",
      "stateEmpty": "Nessun prompt selezionato",
      "recordStop": "Ferma e salva",
      "recordStart": "Inizia registrazione",
      "errors": {
        "username_taken": "Questo username esiste gia.",
        "unauthorized": "Username o password non corretti.",
        "username_password_required": "Servono username e password.",
        "invalid_prompt_id": "Prompt non valido.",
        "empty_audio": "La registrazione e vuota.",
        "payload_too_large": "File audio troppo grande.",
        "NotAllowedError": "Permesso microfono negato.",
        "NotFoundError": "Nessun microfono disponibile."
      }
    },
    "tts": {
      "guideVoice": "Voce guida",
      "storyVoice": "Voce narratore",
      "providerUnavailable": "Sintesi vocale non disponibile.",
      "providerPiper": "Provider attivo: Piper server.",
      "providerBrowser": "Provider attivo: voci del browser.",
      "providerBrowserFallback": "Piper non raggiungibile, uso le voci del browser.",
      "providerPiperFallback": "Voci browser non disponibili, fallback su Piper.",
      "autoServer": "Automatica (server)",
      "autoBrowser": "Automatica (browser)"
    },
    "cards": {
      "elements": {
        "FIRE": {
          "name": "Braci"
        },
        "WATER": {
          "name": "Goccia"
        },
        "NATURE": {
          "name": "Germoglio"
        },
        "LIGHT": {
          "name": "Raggio"
        },
        "SHADOW": {
          "name": "Eclissi"
        },
        "THUNDER": {
          "name": "Saetta"
        }
      },
      "templates": {
        "ROSSO": {
          "name": "Braci",
          "description": "Le Braci scaldano e danno luce, ma vanno usate con attenzione."
        },
        "BLU": {
          "name": "Goccia",
          "description": "La Goccia aiuta le piante a crescere, ma va usata con calma."
        },
        "VERDE": {
          "name": "Germoglio",
          "description": "Il Germoglio cresce forte, ma solo con tanta pazienza."
        },
        "GIALLO": {
          "name": "Raggio",
          "description": "Il Raggio illumina la strada, ma acceca chi lo guarda troppo da vicino."
        },
        "VIOLA": {
          "name": "Eclissi",
          "description": "L'Eclissi ti fa fermare e osservare, ma chi resta troppo nell'ombra rischia di perdersi."
        },
        "NERO": {
          "name": "Saetta",
          "description": "La Saetta arriva veloce e forte, ma chi la usa senza pensare rischia di perdere il controllo."
        }
      }
    },
    "game": {
      "startAdventure": "Inizia l'avventura.",
      "startingCard": "Carta iniziale: {cardId}.",
      "winCombat": "{player} batte {enemy}.",
      "loseCombat": "{player} perde contro {enemy}.",
      "drawCombat": "{player} pareggia con {enemy}.",
      "victory": "Hai completato l'avventura!",
      "gameOver": "L'avventura si ferma qui, ma puoi riprovare.",
      "resume": "Si riparte.",
      "unknownCard": "Carta non riconosciuta: {id}."
    },
    "sketch": {
      "webcamPreparing": "Sto preparando la fotocamera...",
      "webcamChanging": "Sto cambiando fotocamera...",
      "webcamUnsupported": "Questo browser non supporta bene la fotocamera. Prova Chrome, Edge o Safari.",
      "webcamRequestingPermission": "Sto chiedendo il permesso per usare la fotocamera...",
      "webcamActive": "Fotocamera attiva.",
      "webcamActiveStatus": "Fotocamera attiva. Mostra una carta per iniziare la tua avventura.",
      "webcamAttempt": "Tentativo fotocamera {attempt}/3...",
      "webcamRetry": "Non riesco ad attivare la fotocamera. Tocca il pulsante per riprovare.",
      "webcamNotFound": "Non trovo una fotocamera. Collegane una e ricarica.",
      "webcamNotWorking": "Non ho trovato una fotocamera funzionante.",
      "webcamSearchError": "C'e stato un problema mentre cercavo le fotocamere.",
      "showCard": "Mostra una carta alla webcam per iniziare la tua avventura.",
      "introSubtitle": "Un solitario elementale guidato dalla magia della tua webcam.",
      "introPrompt": "Mostra una carta alla webcam per iniziare",
      "providerAuto": "Automatico",
      "providerPiper": "Piper server",
      "providerBrowser": "Browser",
      "statusUnknown": "Sintesi vocale non disponibile.",
      "voiceLabelAutoServer": "Automatica (server)",
      "voiceLabelAutoBrowser": "Automatica (browser)",
      "storyLoadError": "Errore caricamento storia",
      "adventureStarted": "Avventura iniziata.",
      "adventureRestarted": "Nuova avventura.",
      "storyEvent": "Carte avversarie: {cards}",
      "cardInSlot": "{card} nello slot. {line}",
      "cardInSingleSlot": "{line} Togli la carta.",
      "modeSimultaneous": "Modalita' sfida multipla.",
      "modeSequential": "Modalita' una carta alla volta.",
      "unrecognizedCard": "Non riconosco questa carta: {id}.",
      "listening": "Ascolta...",
      "roundWon": "ROUND VINTO!",
      "roundLost": "ROUND PERSO",
      "roundDraw": "PAREGGIO",
      "roundWonBody": "Hai superato la prova.",
      "roundLostBody": "Perdi un cuore, ma puoi imparare dal round.",
      "roundDrawBody": "Osserva meglio gli elementi per il prossimo turno.",
      "gameOverTitle": "AVVENTURA FINITA",
      "gameOverSubtitle": "Mostra una carta per ricominciare.",
      "victoryTitle": "BRAVISSIMO!",
      "victorySubtitle": "Mostra una carta per una nuova avventura.",
      "hearts": "Cuori:",
      "roundCounter": "Round: {current}/{total}",
      "enemyCounter": "Carta avversaria: {current}/{total}",
      "enemyHint": "Suggerimento: contro {enemy}, prova {choices}.",
      "webcamLabel": "Webcam",
      "webcamPermissionHint": "Concedi il permesso e premi F5 per ricaricare.",
      "howToPlay": "COME SI GIOCA",
      "howToPlayLines": [
        "Le tue carte sono fisiche.",
        "Mostrale alla webcam per giocarle.",
        "Il computer legge e parla.",
        "Se vinci avanzi nella mappa.",
        "Se perdi, -1 HP.",
        "Vinci dopo 8 round."
      ],
      "statusLabel": "STATO",
      "guideVoiceEnabled": "Voce guida attivata.",
      "guideVoiceDisabled": "Voce guida disattivata.",
      "guideVoiceUpdated": "Voce guida aggiornata.",
      "storyVoiceUpdated": "Voce narratore aggiornata.",
      "debugEnabled": "Modalita debug attiva: usa i pulsanti rapidi per simulare i QR code.",
      "familyVoiceAccessActive": "Accesso attivo. Le registrazioni di famiglia possono essere usate dal gioco quando disponibili.",
      "openStudio": "Apri lo studio",
      "playerCardSlot": "La tua\ncarta"
    },
    "promptCatalog": {
      "groupGameplayTitle": "Frasi di gioco",
      "groupGameplayDescription": "Prompt essenziali del gameplay che possono usare voci di famiglia.",
      "titleGameStart": "Inizio avventura",
      "titleModeSequential": "Modalita una carta alla volta",
      "titleModeSimultaneous": "Modalita sfida multipla",
      "titleCardSlot": "{name} nello slot",
      "titleCardSingle": "{name} nello slot singolo",
      "titleEnemy": "{name} nemico",
      "storyGroupDescription": "Passaggi narrativi della storia {title}"
    },
    "printPage": {
      "title": "Specula Elementae - Carte da stampare",
      "heading": "Carte da stampare",
      "intro": "Ogni carta include il proprio QR code. Usale con {app}.",
      "tip": "Suggerimento: stampa su carta rigida o plastifica le carte.",
      "playModesTitle": "Due modi per giocare",
      "playModeFreeTitle": "Modalita libera:",
      "playModeFreeBody": "tutte le 6 carte restano sempre disponibili, quindi il gioco e' piu' immediato e adatto ai bambini piu' piccoli.",
      "playModeDeckTitle": "Modalita mazzo:",
      "playModeDeckBody": "prepara un mazzo con piu' copie delle 6 carte, pesca 5 carte all'inizio e poi continua a pescare durante la partita. In questo modo il gioco diventa piu' difficile e strategico.",
      "backToGame": "Torna al gioco",
      "printButton": "Stampa",
      "restartName": "Ricomincia",
      "restartDescription": "Ricomincia la partita.",
      "beatsSingle": "batte",
      "beatsPlural": "battono"
    }
  }
};
