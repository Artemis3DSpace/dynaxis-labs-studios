# Dynaxis Labs Studios — Licensing Audit

**Date:** 2026-07-21  
**Purpose:** Establish what can be modified, redistributed, and commercially deployed.  
**Disclaimer:** This is an engineering inventory, not formal legal advice. Confirm with counsel for commercial launch.

---

## 1. Summary

Primary host repository and the npm workspace packages inspected declare **MIT**. Submodule packages used at runtime also declare **MIT** (README and/or LICENSE). MIT permits commercial use, modification, and redistribution **provided copyright and permission notices are retained**.

---

## 2. Licensing table

| Component | Path | Licence evidence | Copyright / notes | Commercial use |
|-----------|------|------------------|-------------------|----------------|
| Main repository | `/` (`LICENSE`, `package.json`) | MIT | `Copyright (c) 2026 Open Generative AI Contributors` | Allowed with notice |
| Studio package | `packages/studio/package.json` | MIT (`"license": "MIT"`) | No separate LICENSE file found | Allowed; retain notices |
| Vibe Workflow submodule | `packages/Vibe-Workflow/LICENSE` | MIT | `Copyright (c) 2024 Vibe Workflow Contributors` | Allowed with notice |
| Workflow builder package | `packages/Vibe-Workflow/packages/workflow-builder/package.json` | MIT | Inherits submodule licence | Allowed with notice |
| Open-AI-Design-Agent submodule | `packages/Open-AI-Design-Agent/LICENSE` | MIT | `Copyright (c) 2023 Anil Chandra Naidu Matcha` | Allowed with notice |
| Design agent package | `packages/Open-AI-Design-Agent/packages/design-agent/package.json` | MIT | | Allowed with notice |
| Open-Poe-AI submodule | `packages/Open-Poe-AI/README.md` Licence section | MIT (README; **no LICENSE file found in tree**) | Add/verify formal LICENSE file when Dynaxis forks submodule | Practically treated as MIT; tighten documentation |
| Agents package | `packages/Open-Poe-AI/packages/agents/package.json` | MIT | | Allowed with notice |
| Electron / packaging scripts | root | Covered by root MIT | | Allowed |
| Local AI binaries downloaded at runtime | GitHub Releases (`sd-cli-…`) | **Not re-licensed by this repo’s MIT** | Binary licence may differ; verify before redistribution | **REVIEW** before bundling/redistributing |
| MuAPI service | External SaaS | MuAPI Terms of Service | Not OSS in this repo | Commercial use governed by MuAPI agreement + keys |
| CDN demo assets | `cdn.muapi.ai` | External | Usage depends on MuAPI/content terms | Do not assume perpetual redistribution rights |
| npm dependencies | `node_modules` (lockfile) | Mixed (MIT/Apache/etc. typical) | Run licence scanner before release | Standard OSS compliance process |

---

## 3. Attribution requirements (operational)

When distributing Dynaxis Labs Studios builds:

1. Keep root `LICENSE` (MIT text).  
2. Prefer an `NOTICE` or `THIRD_PARTY_NOTICES` that lists:
   - Open Generative AI Contributors  
   - Vibe Workflow Contributors  
   - Anil Chandra Naidu Matcha (Design Agent)  
   - Open-Poe-AI / agents attribution  
3. Do not delete submodule LICENSE files.  
4. Document MuAPI as a required third-party service (not an MIT component).  

---

## 4. Gaps / actions

| Gap | Recommendation |
|-----|----------------|
| Open-Poe-AI missing top-level `LICENSE` file | When Dynaxis controls a fork, add explicit MIT LICENSE matching README |
| Local inference binary licence unclear from this repo alone | Inventory licences of sd.cpp / bundled tools before commercial desktop distribution |
| No automated licence scan in CI | Add `license-checker` / FOSSA / similar in a later hardening phase |
| Apps Studio links to many external template repos | Those repos have their own licences; integrating code later requires per-repo review |

---

## 5. Dynaxis fork implications

- Renaming the product to Dynaxis Labs Studios is compatible with MIT.  
- Adding Dynaxis copyright alongside upstream copyright is the correct pattern.  
- Replacing branding does **not** remove attribution duties.  
- Embedding additional SamurAIGPT mini apps later requires **per-repository** licence checks before copying code into Dynaxis modules.
