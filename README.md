# Parklights Studija

Grupės dashboardas (kas ką įgrojo, MP3 eksportai, komentarai prie dainų) Cloudflare Workers'e.
Komentuoti galima be jokio prisijungimo: viršuje pasirenki, kas tu, ir rašai.

## Diegimas

```sh
cd ~/projects/parklights-studija
./deploy.sh
```

`deploy.sh` paima Cloudflare token'ą iš `.env` (failas neturi patekti į bendrus diskus) ir paleidžia `wrangler deploy`.

## Struktūra

- `public/index.html` - visas puslapis. Dainų būsena - `const DATA = [...]` bloke.
- `public/audio/<dainos id>.mp3` - naujausi eksportai (DATA laukas `exp.file`).
- `src/worker.js` - komentarų API (`/api/comments`) ir MP3 su Range palaikymu.
- `db/schema.sql` - D1 lentelė `comments` (DB `parklights-studija`).

## Komentarai

- D1 lentelė `comments`: `id, song, author (VS/LM/AR/RS), text, at, owner`.
- `song` = dainos `id` DATA masyve - pervadinant dainą `id` nekeisti.
- `owner` = naršyklės rakto SHA-256. Ištrinti komentarą gali tik ta naršyklė, kuri jį parašė.
  Kitus galima ištrinti per D1 konsolę: `DELETE FROM comments WHERE id = '...'`.
- Kitų komentarai atsinaujina kas 30 s ir grįžus į skirtuką.
