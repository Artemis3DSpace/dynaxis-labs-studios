/**
 * Browser-safe local history scanning (hg_* keys).
 * Does not import database / server services.
 */

/** Known studio persist keys → feature registry id */
export const HG_STUDIO_FEATURE_MAP = {
  hg_image_studio_persistent: 'image-studio',
  hg_video_studio_persistent: 'video-studio',
  hg_cinema_studio_persistent: 'cinema-studio',
  hg_audio_studio_persistent: 'audio-studio',
  hg_lipsync_studio_persistent: 'lipsync-studio',
  hg_vibe_motion_studio_persistent: 'vibe-motion',
  hg_clipping_studio_persistent: 'clipping-studio',
  hg_recast_studio_persistent: 'body-swap',
  hg_marketing_studio_persistent: 'marketing-studio',
  hg_ai_influencer_studio_persistent: 'ai-influencer',
};

/**
 * Scan known hg_* keys and build import payload entries.
 * @returns {Array<object>}
 */
export function collectLocalHistoryEntries() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const entries = [];
  for (const studioKey of Object.keys(HG_STUDIO_FEATURE_MAP)) {
    try {
      const raw = window.localStorage.getItem(studioKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.history)
          ? parsed.history
          : Array.isArray(parsed?.localHistory)
            ? parsed.localHistory
            : Array.isArray(parsed?.items)
              ? parsed.items
              : [];
      for (const item of list) {
        const url =
          item?.url ||
          item?.outputUrl ||
          item?.imageUrl ||
          item?.videoUrl ||
          item?.audioUrl ||
          item?.result?.url ||
          (Array.isArray(item?.outputs) ? item.outputs[0] : null);
        if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue;
        entries.push({
          studioKey,
          url,
          prompt: item.prompt || item.input?.prompt || null,
          model: item.model || item.modelId || null,
          createdAt: item.createdAt || item.timestamp || item.created_at || null,
          type: item.type || undefined,
          metadata: { localId: item.id || null },
        });
      }
    } catch {
      // ignore corrupt studio blobs
    }
  }
  return entries;
}
