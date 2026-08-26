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

Über den Text tippen = **Pause / Weiter**. Mit **−** und **＋** wird das Tempo im Lauf verändert,
**⤒** springt zurück zum Anfang. Ohne Aufnahme läuft der Prompter über **„▶ Nur Prompter"**.

Angeschlossene Bluetooth-Tastaturen und -Fernbedienungen funktionieren ebenfalls:
Leertaste = Pause/Weiter, Pfeil hoch/runter = Tempo, Home = Anfang, Esc = zurück.

**Wichtig:** Oben im Prompter steht immer, welches Mikrofon tatsächlich benutzt wird
(z. B. `🎤 DJI MIC MINI · 1920×1080 · MP4`). So fällt sofort auf, wenn das Handy
doch auf sein eigenes Mikrofon zurückgefallen ist.

## Einstellungen

Tempo (in Wörtern pro Minute), Schriftgröße, Zeilenabstand, Seitenrand, Schriftfarbe,
Lesemarke (Art und Position), Countdown, Bildschirm-Ausrichtung, Spiegelung für
Spiegel-Teleprompter, Selbstbild samt Größe, Mikrofonauswahl und die Sprachfilter des Handys.

Das Tempo wird in Wörtern pro Minute eingestellt statt in Pixeln pro Sekunde. Dadurch bleibt
das Sprechtempo gleich, auch wenn Schriftgröße oder Textbreite geändert werden – und die
angezeigte Sprechzeit stimmt.

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
- `js/app.js` – Bedienung, Scroll-Motor, Aufnahmesteuerung
- `sw.js` – Offline-Zwischenspeicher
- `make_icons.py` – erzeugt die App-Icons (nur bei Änderungen am Icon nötig)

Das Aufnahmeformat wird auf dem Gerät ermittelt: MP4, wenn möglich, sonst WebM.
Welches Format aktiv ist, steht in den Einstellungen unter „Diese App".

### Nach einer Änderung

In `sw.js` die Zeile `var CACHE_NAME` hochzählen (`-v2`, `-v3`, …), sonst behalten die
Geräte die alte Fassung im Zwischenspeicher. Übernimmt die neue Fassung die Kontrolle,
lädt die App sich selbst neu – außer im Prompter oder während einer laufenden Aufnahme,
weil ein Neuladen die Aufnahme zerstören würde.
