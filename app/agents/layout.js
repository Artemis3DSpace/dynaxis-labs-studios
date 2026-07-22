/**
 * Layout for /agents/* pages.
 * These pages host the AiAgent component full-screen — no studio chrome needed.
 * The API key is available via the muapi_key cookie which the Dynaxis session helper syncs
 * (see lib/dynaxis/session.js). Full Dynaxis identity is Phase 3.
 */
import { DYNAXIS_METADATA } from '@/lib/dynaxis/product';

export const metadata = {
  title: DYNAXIS_METADATA.titleAgents,
};

export default function AgentsLayout({ children }) {
  return (
    <div className="h-screen w-full overflow-hidden bg-black">
      {children}
    </div>
  );
}
