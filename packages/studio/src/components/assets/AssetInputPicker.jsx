'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPlatformClient } from '../../../../../lib/dynaxis/client/platform-api.js';
import { readProjectContext } from '../../../../../lib/dynaxis/client/project-context.js';

/**
 * Minimal Dynaxis Asset picker for Studios (Phase 5E).
 * Filters by type (image | video | audio). Returns Asset identity, not just a URL.
 * Does not redesign Studio layouts.
 */
export default function AssetInputPicker({
  apiKey,
  type = 'image',
  value = null,
  onChange,
  label = null,
  compact = false,
  disabled = false,
  limit = 40,
}) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const typeLabel =
    label ||
    (type === 'video' ? 'Project video' : type === 'audio' ? 'Project audio' : 'Project image');

  const refresh = useCallback(async () => {
    if (!apiKey || apiKey === 'dynaxis-local-preview') {
      setAssets([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const client = createPlatformClient(apiKey);
      const projectId = readProjectContext()?.projectId || null;
      const data = await client.listAssets({
        ...(projectId ? { projectId } : {}),
        limit: String(limit),
      });
      const list = (data?.assets || []).filter(
        (a) => a && a.type === type && a.url && /^https?:\/\//i.test(a.url)
      );
      setAssets(list);
    } catch (err) {
      setError(err?.message || 'Unable to load Assets');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey, type, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectAsset = (asset) => {
    onChange?.(asset || null);
    setOpen(false);
  };

  const selected = value || null;

  return React.createElement(
    'div',
    { className: `relative ${compact ? '' : 'w-full'}` },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-2 mb-1' },
      React.createElement(
        'span',
        {
          className:
            'text-[10px] font-bold uppercase tracking-widest text-white/35',
        },
        typeLabel
      ),
      selected
        ? React.createElement(
            'button',
            {
              type: 'button',
              disabled: disabled || loading,
              onClick: () => selectAsset(null),
              className: 'text-[10px] text-white/40 hover:text-white/70',
            },
            'Clear'
          )
        : null
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        disabled: disabled || loading || !apiKey,
        onClick: () => setOpen((o) => !o),
        className:
          'w-full h-9 px-3 rounded-md border border-white/10 bg-black/40 text-left text-[12px] text-white/80 hover:border-white/20 disabled:opacity-40 flex items-center justify-between gap-2',
      },
      React.createElement(
        'span',
        { className: 'truncate flex items-center gap-2' },
        selected?.url && type !== 'audio'
          ? React.createElement('img', {
              src: selected.url,
              alt: '',
              className: 'w-5 h-5 rounded object-cover shrink-0',
            })
          : null,
        loading
          ? 'Loading…'
          : selected
            ? selected.prompt?.slice?.(0, 40) ||
              selected.model ||
              selected.id?.slice?.(0, 8) ||
              'Selected Asset'
            : `None — optional ${type}`
      ),
      React.createElement('span', { className: 'text-white/30 text-[10px]' }, '▾')
    ),
    error
      ? React.createElement(
          'p',
          { className: 'mt-1 text-[10px] text-amber-300/80' },
          error
        )
      : null,
    open
      ? React.createElement(
          'div',
          {
            className:
              'absolute z-30 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-white/10 bg-[#0c0c0c] shadow-xl',
          },
          assets.length === 0
            ? React.createElement(
                'p',
                { className: 'px-3 py-3 text-[11px] text-white/40' },
                `No ${type} Assets in this Project yet.`
              )
            : assets.map((a) =>
                React.createElement(
                  'button',
                  {
                    key: a.id,
                    type: 'button',
                    onClick: () => selectAsset(a),
                    className: `w-full text-left px-3 py-2 text-[12px] hover:bg-white/5 flex items-center gap-2 ${
                      selected?.id === a.id
                        ? 'bg-[#22d3ee]/10 text-[#22d3ee]'
                        : 'text-white/80'
                    }`,
                  },
                  type !== 'audio' && a.url
                    ? React.createElement(
                        type === 'video' ? 'video' : 'img',
                        {
                          src: a.url,
                          muted: true,
                          className: 'w-8 h-8 rounded object-cover shrink-0 bg-black/40',
                        }
                      )
                    : React.createElement(
                        'span',
                        {
                          className:
                            'w-8 h-8 rounded bg-white/5 flex items-center justify-center text-[9px] uppercase text-white/40 shrink-0',
                        },
                        'AUD'
                      ),
                  React.createElement(
                    'div',
                    { className: 'min-w-0 flex-1' },
                    React.createElement(
                      'div',
                      { className: 'font-semibold truncate' },
                      a.prompt?.slice?.(0, 48) || a.model || a.id?.slice(0, 8)
                    ),
                    React.createElement(
                      'div',
                      {
                        className:
                          'text-[9px] uppercase tracking-wider text-white/30',
                      },
                      a.source || a.type || 'asset'
                    )
                  )
                )
              )
        )
      : null
  );
}
