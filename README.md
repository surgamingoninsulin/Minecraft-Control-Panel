# Mineraft Minecraft Panel

Unified Minecraft server panel project with:
- Login/setup flow
- Server control + console
- File manager
- Plugin/mod manager
- Provider search support (CurseForge + Modrinth)

## Run (from `./mineraft`)

1. Install everything:
```bash
npm install
npm run install:all
```

2. Start development (frontend + backend together):
```bash
npm run dev
```

3. Production-style merged run:
```bash
npm run start:full
```

`start:full` builds the frontend and serves it directly from the backend.
