# Dynaxis Labs Studios — Branding Migration Inventory

**From:** Open Generative AI / `open-generative-ai` / `Open-Generative-AI`  
**To:** Dynaxis Labs Studios  
**Rule:** No blind global search-and-replace. Preserve upstream attribution and licences.

Classification key:

- **SAFE TO RENAME** — Product-facing Dynaxis branding  
- **MUST KEEP** — Upstream attribution, licence copyright lines, historical release URLs when citing origin  
- **REVIEW NEEDED** — Technical IDs, paths, or dual-use strings that may break installs/updates  

---

## 1. Product-facing strings — SAFE TO RENAME

| Location | Current | Notes |
|----------|---------|-------|
| `app/layout.js` metadata title/description | “Open Generative AI — …” | Primary web SEO/brand |
| `app/studio/[[...slug]]/page.js` | “Studio — Open Generative AI” | |
| `app/workflow/*/page.js` titles | “Workflow — Open Generative AI” | |
| `app/agents/**` titles | “Agent Chat — Open Generative AI” | |
| `components/ApiKeyModal.js` | default title “Open Generative AI” | |
| `packages/studio/src/components/McpCliStudio.jsx` | body copy “Use Open Generative AI…” | |
| `index.html` title/description | Open Generative AI | Electron/Vite HTML |
| `src/lib/i18n.js` | Open Generative AI + open-generative-ai.com strings | EN/ZH |
| `electron/main.js` | window title + error dialogs | User-visible |
| `package.json` `description` | HF AI alternative copy | Product description |
| `packages/studio/package.json` description | “Open Generative AI studio components…” | |
| README hero / marketing sections | Extensive Open Generative AI branding | Replace with Dynaxis README **after** preserving upstream attribution section |
| `project_knowledge.md` | Product naming | Can rebrand or archive as historical |

---

## 2. Electron / packaging identifiers — REVIEW NEEDED

| Location | Current | Risk if changed carelessly |
|----------|---------|----------------------------|
| `package.json` `build.appId` | `ai.generative.open` | Updates may look like a different app; plan migration |
| `package.json` `build.productName` | `Open Generative AI` | Installer names, macOS `.app` |
| `package.json` `name` | `open-generative-ai` | npm workspace name; change carefully |
| `package.json` linux `maintainer` | Open Generative AI Team | |
| `build/installer.nsh` | install dir + exe kill name | Windows upgrades |
| `build/linux/apparmor.profile` | `open-generative-ai` profile path | Linux security profile |
| `scripts/package-linux-deb.js` | `PACKAGE_NAME`, `COMMAND_NAME`, maintainer | deb package identity |
| `docker-compose.yml` | service/container `open-generative-ai` | Ops scripts |
| Electron user-agent / data dirs | `open-generative-ai` paths in README/local AI | Existing user data directories |
| `electron/lib/localInference.js` User-Agent | `open-generative-ai` | Low risk; still review |
| Local AI download URLs | GitHub release assets under `Anil-matcha/Open-Generative-AI` | **Do not break** binary distribution without Dynaxis-hosted mirrors |

Recommended Phase 2 approach:

1. Change **user-visible** names first (titles, shell, metadata).  
2. Plan `appId` / data-directory migration with explicit upgrade notes.  
3. Keep fetching upstream binaries until Dynaxis mirrors exist.

---

## 3. Upstream attribution — MUST KEEP

| Item | Why |
|------|-----|
| Root `LICENSE` copyright line (update allowed **only** by adding Dynaxis copyright **in addition**, not erasing upstream) | MIT requires notice preservation |
| Submodule `LICENSE` files (`Vibe-Workflow`, `Open-AI-Design-Agent`) | Independent upstream copyrights |
| README “forked from / based on Open Generative AI” attribution block | Good practice + origin clarity |
| Links to upstream repos when documenting provenance | Historical accuracy |
| SamurAIGPT / Anil-matcha links that cite tools you still use (muapi-cli, MCP, templates) | Factual dependency attribution |
| Comments referencing security CWEs / intentional MuAPI proxy behaviour | Not branding; keep |

Do **not** rewrite submodule README brand stories inside submodules unless those remotes are also Dynaxis-controlled forks.

---

## 4. Hosted / third-party URLs — REVIEW NEEDED

| URL / pattern | Guidance |
|---------------|----------|
| `https://muapi.ai/open-generative-ai` | Upstream hosted demo; keep as “upstream reference” or remove from Dynaxis marketing |
| `utm_campaign=open-generative-ai` | Optional; Dynaxis may use its own UTM later |
| `cdn.muapi.ai` asset URLs | Functional dependency; not a brand rename |
| Template Vercel demos | Remain as external demos until modules exist |
| `open-generative-ai.com` strings in i18n | Replace with Dynaxis domain when available |

---

## 5. Logos / visual identity

| Asset area | Notes |
|------------|-------|
| `public/` / `public/assets/` | Audit for OG AI marks; replace with Dynaxis assets in Phase 2 |
| `public/banner.png` | Used as Electron mac/win/linux icon. **Visual text still reads “OPEN-HIGGSFIELD AI”** (legacy mark, not Open Generative AI). **Highest-priority asset replace** in Phase 2 |
| `public/vite.svg` | Default Vite favicon in Electron HTML — replace |
| Favicon / app icons | Root Next app has no dedicated product favicon; add Dynaxis set |

No Dynaxis logo assets were introduced in Phase 1.

---

## 6. Suggested Phase 2 branding sequence

1. Web metadata + shell titles + ApiKeyModal  
2. Studio package user-visible strings (MCP page, etc.)  
3. Electron window title / dialogs  
4. Dynaxis README (with upstream attribution section)  
5. Packaging IDs (`productName`, deb/appId) behind an explicit migration checklist  
6. i18n domain strings  

---

## 7. Explicit non-actions

- Do not rename MuAPI  
- Do not strip MIT licences  
- Do not rewrite history of GitHub release URLs required for local binaries until mirrored  
- Do not “fix” submodule remotes’ branding inside vendored README files without forking those projects
