# Norskinator

Norskinator er en statisk nettapp for å drille norsk grammatikk (bokmål) med
repetisjon med mellomrom. Første tema er preposisjoner. Øvelsene bygger på ekte
setninger fra [Tatoeba](https://tatoeba.org) og på håndskrevne oppgaver med
forklaring.

> [!WARNING]
> **KI-generert.** Kode, håndskrevne oppgaver og forklaringer i dette prosjektet
> er i stor grad skrevet med hjelp av KI (Claude). Innholdet er gjennomgått,
> men kan inneholde feil — også i norsken. Stol ikke blindt på forklaringene,
> og sjekk med en ordbok eller en lærer når noe virker rart. Feil kan meldes
> som issue.
>
> Setningene fra Tatoeba er skrevet av mennesker, men oppgavene er laget
> automatisk av dem. Noen ganger passer derfor mer enn ett alternativ.

- Ingen server og ingen innlogging: all framgang lagres i nettleserens
  `localStorage`.
- Fungerer offline og kan installeres som app (PWA).
- Bygges med Vite, Lit og TypeScript og kjøres som Docker-image (nginx).

## Kom i gang

Prosjektet bruker kun pnpm. Node-versjonen står i `.nvmrc`.

```bash
pnpm install
pnpm dev
```

`pnpm dev` starter Vite sin utviklingsserver.

## Kommandoer

| Kommando         | Hva den gjør                                                    |
| ---------------- | --------------------------------------------------------------- |
| `pnpm dev`       | Starter utviklingsserveren.                                     |
| `pnpm verify`    | Typesjekk, tester og produksjonsbygg i én kjøring.              |
| `pnpm build`     | Bygger den statiske appen til `dist/`.                          |
| `pnpm preview`   | Serverer `dist/` lokalt for å sjekke bygget.                    |
| `pnpm data`      | Laster ned Tatoeba-dataene på nytt og genererer øvelsene.       |

`pnpm data` trenger nettverk. Den genererte øvelsesfilen er sjekket inn, så
vanlige bygg klarer seg uten.

## Docker

Imaget bygger appen (inkludert typesjekk og tester) og serverer den statisk med
nginx (uten root-rettigheter, port 8080).

```bash
docker build -t norskinator .
docker run -d --name norskinator -p 8080:8080 norskinator
# eller: docker compose up -d --build
```

Appen kjører da på <http://localhost:8080>. Bygget bruker relative stier, så
den kan også ligge bak en reverse proxy under en undermappe. `GET /healthz`
svarer `ok` for helsesjekker. Konfigurasjonen ligger i `docker/nginx.conf`.

### Ferdig image fra GitHub

`.github/workflows/ci.yml` kjører typesjekk, tester og bygg på hver push og
pull request. Ved push til `main` og ved tags `v*` publiseres imaget for
`amd64` og `arm64` til GitHub Container Registry:

```bash
docker pull ghcr.io/aligator/norskinator:latest   # eller :1.2.3, :sha-abc1234
```

Pakken er privat første gang den publiseres. Gjør den offentlig under
*Packages → norskinator → Package settings* hvis klyngen skal hente den uten
innlogging.

### Valgfri innlogging (basic auth)

```bash
docker run -d -p 8080:8080 \
  -e BASIC_AUTH_USER=anna \
  -e BASIC_AUTH_PASSWORD='hemmelig' \
  norskinator
```

- Uten begge variablene er appen åpen. Er bare én satt, starter ikke
  containeren.
- `BASIC_AUTH_PASSWORD` kan også være en hash, f.eks. fra
  `openssl passwd -apr1` (`$apr1$…`). I `compose.yaml`/`.env` må `$` da skrives
  som `$$`.
- `/healthz`, manifest og ikoner er åpne, ellers kan appen ikke installeres.
- Nettleseren husker innloggingen; etter første lasting kommer appen fra
  service workerens cache.

### Bak en reverse proxy

Service worker krever HTTPS (unntatt `localhost`), så TLS avsluttes i proxyen.
Under en undermappe, f.eks. `/norsk/`:

```nginx
location = /norsk { return 301 /norsk/; }

location /norsk/ {
    proxy_pass http://norskinator:8080/;   # skråstreken fjerner /norsk
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Vil du ha innloggingen i proxyen i stedet, la `BASIC_AUTH_*` være tomme i
containeren og bruk `auth_basic` der, men slå den av for
`manifest.webmanifest` og ikonene.

Driver du appen for andre, skal de kunne finne kildekoden (AGPL). Sett lenken
ved bygging, så vises den under Innstillinger → Om:

```bash
docker build --build-arg SOURCE_URL=https://github.com/aligator/norskinator -t norskinator .
```

**Merk (Tyskland):** kjører appen bare lokalt eller i et privat nettverk, er
den rent privat. Gjøres den offentlig tilgjengelig på internett, trengs
sannsynligvis et Impressum (§ 18 (1) MStV). Dette er ingen juridisk rådgivning.

## Nye temaer og oppgavetyper

Arkitekturen og kodestilen er beskrevet i [`AGENTS.md`](./AGENTS.md). Kort
fortalt:

- **Nytt tema (deck):** lag `src/decks/<tema>/index.ts` som eksporterer en
  `Deck`, og legg den til i `DECKS` i `src/decks/registry.ts`.
- **Ny oppgavetype:** utvid `ExerciseKind` i `src/core/types.ts`, håndter den i
  `src/core/checker.ts` og vis den i `src/ui/modules/practice/exercise-card.ts`.

## Lisens og kreditering

Koden er lisensiert under [AGPL-3.0-or-later](./LICENSE). Den som
publiserer en endret versjon, også bare som nettside, må gjøre kildekoden
tilgjengelig under samme lisens. Setningene fra Tatoeba har sin
egen lisens (CC BY 2.0 FR), og fontene er lisensiert under SIL Open Font
License 1.1. Lit er lisensiert under BSD-3-Clause. Detaljer står i
[`ATTRIBUTION.md`](./ATTRIBUTION.md).
