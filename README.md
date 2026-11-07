# Teleprompter

Ein Teleprompter für das Smartphone, der **gleichzeitig mit der Frontkamera aufnimmt** –
inklusive Ton von einem externen Mikrofon (z. B. DJI Mic Mini über den USB-C-Empfänger).

Die App läuft direkt im Browser, wird als App auf dem Startbildschirm installiert und
funktioniert danach vollständig offline.

## Datenschutz

Das war der Grund, diese App zu bauen:

- **Keine Datenübertragung.** Die App enthält keinen einzigen Aufruf an einen fremden Server –
  keine Analytics, keine Fehler-Berichte, keine Schriftarten von Google, keine Bibliotheken aus dem Netz.
- **Kein Konto, keine Anmeldung, keine Werbung.**
- **Video, Ton, Texte und Einstellungen bleiben auf dem Gerät.** Das Video wird direkt in den
  Downloads-Ordner gespeichert.
- **Nur zwei Berechtigungen:** Kamera und Mikrofon. Nichts weiter.
- Technisch abgesichert durch eine Content-Security-Policy (`connect-src 'self'`),
  die Verbindungen nach außen unterbindet.
- Der Quelltext ist absichtlich unkomprimiert und ohne Frameworks geschrieben,
  damit man ihn nachlesen kann.

Prüfen kann man das selbst: Handy in den Flugmodus versetzen – die App funktioniert
unverändert weiter, Aufnahme inklusive.

## Installation auf dem Handy

1. Die Seite in **Chrome** öffnen.
2. Im Menü (drei Punkte) auf **„App installieren"** bzw. **„Zum Startbildschirm hinzufügen"** tippen.
3. Beim ersten Start **Kamera und Mikrofon erlauben**.

## Bedienung

**Texte** werden auf der Startseite angelegt und verwaltet (Bearbeiten, Duplizieren, Löschen).
Unter jedem Titel stehen Wortzahl und geschätzte Sprechzeit.

**Aufnehmen:** Text antippen → der Prompter öffnet sich → **„● Aufnahme + Prompter"**.
Nach dem Countdown läuft die Aufnahme und der Text beginnt zu scrollen.
Am Ende **„■ Stopp & speichern"** – das Video landet in den Downloads.

Der Aufnahme-Knopf zeigt seinen Zustand selbst an: kurz nach dem Öffnen steht dort
**„Kamera wird gestartet …"** (noch nicht tippbar), nach ein bis zwei Sekunden
**„● Aufnahme + Prompter"**. Bleibt er auf **„Aufnahme nicht möglich"**, fehlt die
Berechtigung für Kamera oder Mikrofon – der eingeblendete Hinweis erklärt dann, wo sie
erteilt wird. Während der Aufnahme laufen oben links ein roter Punkt und ein Timer.

**Verhaspelt? Pause und zurück.** Während des Laufs sind **„❚❚ Text anhalten"** und
**„■ Stopp & speichern"** immer sichtbar. Die Pause hält **nur den Text** an – die Aufnahme
läuft bewusst weiter, die Versprecher werden später im Schnitt entfernt (z. B. automatisch
anhand der Sprechpausen oder eines gesprochenen Hinweises wie „Aufnahme nochmal").
Im angehaltenen Zustand erscheinen die Sprungknöpfe:

- **↑ Absatz** / **↑ Satz** – zum Anfang des aktuellen Absatzes bzw. Satzes; nochmals tippen
  springt einen weiter zurück. Das Ziel leuchtet kurz grün auf.
- **↑ Zeile** / **↓ Zeile** – zeilenweise feinjustieren.
- Oder den Text einfach mit dem Finger verschieben (Wischen hält den Text automatisch an).

**„▶ Weiter"** startet nach einem kurzen Vorlauf (Standard 2 Sekunden, einstellbar) – der
kleine Zähler oben rechts lässt den Text frei, damit du den Satz schon lesen kannst.
Während des Vorlaufs heißt der Knopf **„✕ Vorlauf stoppen"**. Am Textende wird daraus
**„⤒ Von vorn"**.

**Neue Aufnahme ab einer bestimmten Stelle:** Nach „Stopp & speichern" bleibt der Text, wo er
war. Mit den Sprungknöpfen oder per Wischen die Startstelle wählen und
**„● Aufnahme + Prompter"** tippen – die Aufnahme beginnt dort. **⤒** springt vorher zum Anfang.

**Darstellung direkt im Prompter anpassen:** Unten in der Leiste öffnet **⚙** die
Schnelleinstellungen (läuft der Text, blendet sich diese Leiste nach 3 Sekunden aus – dann
erst „❚❚ Text anhalten" tippen): Schriftgröße, Zeilenabstand, Seitenrand, Tempo, Abdunkelung des
Kamerabildes und Textbereich (ganzer Bildschirm oder oberer Bereich). Alles wirkt sofort, der
Text bleibt an derselben Stelle. Beim Öffnen hält der Text an, eine laufende Aufnahme läuft
weiter. Während einer Aufnahme steht im Feld zusätzlich **„■ Stopp & speichern"**.
**„Alle Einstellungen …"** öffnet die vollständigen Einstellungen (nicht während einer
Aufnahme); **„Zurück zum Prompter"** bzw. **←** führt danach wieder in denselben Text an
dieselbe Stelle.

Über den Text oder das Kamerabild tippen = ebenfalls **Pause / Weiter**. Mit **−** und **＋**
wird das Tempo im Lauf verändert, **⤒** springt zurück zum Anfang. Ohne Aufnahme läuft der
Prompter über **„▶ Nur Prompter"**.

Angeschlossene Bluetooth-Tastaturen und -Fernbedienungen (auch günstige Seitenwender)
funktionieren ebenfalls:

| Taste | Wirkung |
|---|---|
| Leertaste, Enter, Bild ab (PageDown) | Pause / Weiter |
| Pfeil links, Bild auf (PageUp) | ↑ Satz zurück |
| Rücktaste (Backspace) | ↑ Absatz zurück |
| Pfeil rechts | ↓ eine Zeile vor |
| Pfeil hoch / runter | Tempo schneller / langsamer |
| Home | zum Anfang |
| Esc | zurück zur Liste |

### Kamerabild als Vollbild

Standardmäßig füllt das Kamerabild den Bildschirm, der Text läuft darüber. Zu sehen ist
**genau der aufgenommene Bildausschnitt** – so lässt sich prüfen, ob ein gezeigter Gegenstand
richtig im Bild ist. Text, Knöpfe und Abdunkelung erscheinen **nicht** im Video.

Einstellbar unter „Kamera & Ton": Selbstbild (Vollbild, mittel, klein, aus), Spiegeln
(aus = Schrift auf gezeigten Produkten ist lesbar wie im fertigen Video), Abdunkelung des
Kamerabildes und Textbereich (oberer Bereich mit rund 40 % der Höhe oder ganzer Bildschirm).
Im Hochformat füllt das 9:16-Bild die Breite; oben und unten bleiben schmale schwarze
Streifen, weil das Handy-Display länger ist als das Video.

**Wichtig:** Oben im Prompter steht immer, welches Mikrofon tatsächlich benutzt wird
(z. B. `🎤 DJI MIC MINI · 1920×1080 · MP4`). So fällt sofort auf, wenn das Handy
doch auf sein eigenes Mikrofon zurückgefallen ist.

## Einstellungen

Tempo (in Wörtern pro Minute), Schriftgröße, Zeilenabstand, Seitenrand, Schriftfarbe,
Lesemarke (Art und Position), Countdown, Bildschirm-Ausrichtung, Spiegelung für
Spiegel-Teleprompter, Vorlauf nach einer Pause, Selbstbild (Vollbild/Ecke/aus), Spiegeln des
Selbstbildes, Abdunkelung, Textbereich, Mikrofonauswahl und die Sprachfilter des Handys.

Das Tempo wird in Wörtern pro Minute eingestellt statt in Pixeln pro Sekunde. Dadurch bleibt
das Sprechtempo gleich, auch wenn Schriftgröße oder Textbreite geändert werden – und die
angezeigte Sprechzeit stimmt.

## Nach der Aufnahme: Teilen

Nach „Stopp & speichern" liegt das Video in den Downloads. Im Hinweis erscheint zusätzlich
**„Teilen …"** – damit geht die Datei über das Teilen-Menü des Handys direkt an Google Fotos,
Drive oder eine Schnitt-App. Die App selbst überträgt dabei nichts.

## Absturzsicherung

Während der Aufnahme wird jede Sekunde zusätzlich eine Sicherungskopie in den lokalen
Speicher des Browsers geschrieben (IndexedDB, bleibt auf dem Gerät). Wird die App mitten in
der Aufnahme geschlossen oder stürzt sie ab, erscheint beim nächsten Start oben auf der
Startseite **„Unterbrochene Aufnahme gefunden"** mit **Speichern** oder **Verwerfen**.
Nach einer regulär gespeicherten Aufnahme wird die Sicherungskopie automatisch gelöscht.
Während der Aufnahme belegt das Video also zweimal Platz (Arbeitsspeicher und Sicherung),
nach dem Speichern zusätzlich die Datei in den Downloads – bei langen Aufnahmen auf freien
Speicher achten (10 Minuten ≈ 750 MB).

## Sicherung der Texte

Auf der Startseite unter **Sicherung**: **Texte exportieren** legt eine JSON-Datei in die Downloads,
**Texte importieren** liest sie wieder ein (auch einzelne `.txt`-Dateien). Empfehlenswert vor
einem Gerätewechsel, denn es gibt bewusst keine Cloud-Synchronisierung.

## Technik

Reines HTML, CSS und JavaScript – kein Framework, kein Build-Schritt, keine Abhängigkeiten.
Aufnahme über `getUserMedia` und `MediaRecorder`, Offline-Betrieb über einen Service Worker.

- `index.html` – Aufbau der vier Ansichten (Liste, Editor, Einstellungen, Prompter)
- `style.css` – Gestaltung
- `js/store.js` – Texte und Einstellungen im Gerätespeicher
- `js/recorder.js` – Kamera, Mikrofon, Aufnahme, Speichern
- `js/backup.js` – Sicherungskopie während der Aufnahme, Rettung nach Absturz
- `js/app.js` – Bedienung, Scroll-Motor, Aufnahmesteuerung
- `sw.js` – Offline-Zwischenspeicher
- `make_icons.py` – erzeugt die App-Icons (nur bei Änderungen am Icon nötig)

Das Aufnahmeformat wird auf dem Gerät ermittelt: MP4, wenn möglich, sonst WebM.
Die Aufnahme setzt jede Sekunde ein Schlüsselbild – das hält die Sicherungskopie aktuell und
gibt dem Schnitt überall saubere Schnittpunkte.
Welches Format aktiv ist, steht in den Einstellungen unter „Diese App".

### Nach einer Änderung

In `sw.js` die Zeile `var CACHE_NAME` hochzählen (`-v6`, `-v7`, …) **und** in `index.html`
sowie in der Liste `PRECACHE` in `sw.js` die Kennung `?v=` an Stylesheet und Skripten auf
denselben Wert setzen. Sonst behalten die Geräte die alte Fassung im Zwischenspeicher – oder
laden beim ersten Start nach dem Update die neue Seite mit alten Skripten (leere Liste). Übernimmt die neue Fassung die Kontrolle,
lädt die App sich selbst neu – außer im Prompter oder während einer laufenden Aufnahme,
weil ein Neuladen die Aufnahme zerstören würde.
