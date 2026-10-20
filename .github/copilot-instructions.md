# MoveSafe VN - AI Assistant Instructions for VS Code & Copilot

This project is **MoveSafe VN**, a real-time smart traffic, weather monitoring, and flood-avoidance routing web application for Vietnamese metropolitan areas (Hà Nội, TP. Hồ Chí Minh, Đà Nẵng).

## Available Agent Skills (Local Workspace)
The workspace is configured with specialized Agent Skills in `.agents/skills/`:

1. **UI/UX Design Intelligence (`ui-ux-pro-max-skill-2.15.0`)**
   - **Path**: `.agents/skills/ui-ux-pro-max-skill-2.15.0/SKILL.md`
   - **Usage**: When modifying HTML/CSS, creating UI components, designing responsive layouts, or styling modals and cards, adhere to the guidelines, color palettes, and UX patterns defined in this skill.
   - **Project Specific Rule**: All icons and emojis must be eliminated across the user interface, map pins, toast messages, and AI responses. Use clean, high-contrast, text-first labels with modern Slate/Blue accents (`#0f172a`, `#2563eb`).

2. **Office Document Processing (`OfficeCLI-1.0.153`)**
   - **Path**: `.agents/skills/OfficeCLI-1.0.153/SKILL.md`
   - **Usage**: When generating or inspecting Word documents (`.docx`), Excel spreadsheets (`.xlsx`), or presentations (`.pptx`), use the guidelines and CLI tooling provided in this skill.

3. **Persistent Project Memory (`ai-memory`)**
   - **Paths**: 
     - `.agents/skills/ai-memory-retrieval/SKILL.md`
     - `.agents/skills/ai-memory-durable-pages/SKILL.md`
     - `.agents/skills/ai-memory-handoff/SKILL.md`
   - **Usage**: Consult ai-memory for project history, architecture decisions, and session continuity. The local server runs at `http://127.0.0.1:49374/mcp`.

4. **Reverse Engineering & Asset Analysis (`reverse-engineer-anything`)**
   - **Path**: `.agents/skills/reverse-engineer-anything/SKILL.md`
   - **Usage**: Use when analyzing external web bundles, APIs, or native map protocols.

## Core Architectural Guidelines
- **Frontend**: Vanilla ES6+ JavaScript (`js/app.js`, `js/map-engine.js`, `js/routing-service.js`, `js/weather-service.js`), Leaflet.js, standard CSS3 (`css/style.css`).
- **Backend**: Node.js Express (`server/server.js`, `server/bot-service.js`, `server/ai-service.js`), automated GitHub Actions sync (`.github/workflows/cloud-sync-247.yml`).
- **Language**: Vietnamese for all UI text, user-facing error messages, and documentation.
