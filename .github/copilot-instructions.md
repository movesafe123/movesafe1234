# MoveSafe VN - AI Assistant Instructions for VS Code & Copilot

This project is **MoveSafe VN**, a real-time smart traffic, weather monitoring, and flood-avoidance routing web application for Vietnamese metropolitan areas (Hà Nội, TP. Hồ Chí Minh, Đà Nẵng).

## Available Agent Skills (Local Workspace)
The workspace is configured with specialized Agent Skills in `.agents/skills/`:

1. **UI/UX & Frontend Design Suites (`ui-ux-pro-max`, `addyosmani`, `anthropics`, `jakubkrehel`, `vercel-labs`)**
   - **Paths**: Located in `.github/skills/` and `.agents/skills/`:
     - `ui-ux-pro-max-skill-2.15.0/SKILL.md` (Design system, 84 UI styles, 192 color palettes, 74 font pairings)
     - `frontend-ui-engineering/SKILL.md` (Addy Osmani: anti-AI-slop, responsive, accessible, high performance)
     - `frontend-design/SKILL.md` (Anthropic: elegant layout, visual hierarchy, whitespace rhythm)
     - `better-ui/SKILL.md`, `better-interface/SKILL.md`, `better-accessibility/SKILL.md` (Jakub Krehel: micro-interactions, WCAG 2.2)
     - `web-design-guidelines/SKILL.md` (Vercel Labs: modern web product standards, speed, minimalism)
   - **Project Specific Rule**: Use clean, minimalist SVG line icons (e.g. Feather/Lucide vector style) across the interface to enhance vibrancy and usability without clutter. Avoid playful emojis. Use clean, high-contrast typography with modern Slate/Blue accents (#0f172a, #2563eb).

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
