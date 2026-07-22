'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPlatformClient } from '../../../../../lib/dynaxis/client/platform-api.js';
import { readProjectContext } from '../../../../../lib/dynaxis/client/project-context.js';
import {
  resolveCharacterContext,
  clearCharacterGenerationContext,
} from '../../../../../lib/dynaxis/characters/consumer.js';

/**
 * Minimal Dynaxis Character picker for Studios.
 * Does not mutate Characters. Does not redesign shell layouts.
 */
export default function CharacterPicker({
  apiKey,
  value = null,
  onChange,
  onContextResolved,
  label = 'Character',
  compact = false,
  disabled = false,
  consumer = null,
  maxImages = 5,
  selectedAssetIds = null,
}) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!apiKey || apiKey === 'dynaxis-local-preview') {
      setCharacters([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const client = createPlatformClient(apiKey);
      const data = await client.listCharacters();
      setCharacters(data?.characters || []);
    } catch (err) {
      setError(err?.message || 'Unable to load Characters');
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectCharacter = async (characterId) => {
    if (!characterId) {
      onChange?.(null);
      onContextResolved?.(null);
      clearCharacterGenerationContext();
      setOpen(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const client = createPlatformClient(apiKey);
      const projectId = readProjectContext()?.projectId || null;
      const resolved = await resolveCharacterContext(client, characterId, {
        maxImages,
        selectedAssetIds,
        projectId,
        linkToProject: Boolean(projectId),
        consumer,
      });
      onChange?.(resolved.character);
      onContextResolved?.(resolved);
      setOpen(false);
    } catch (err) {
      setError(err?.message || 'Failed to resolve Character');
    } finally {
      setLoading(false);
    }
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
        label
      ),
      selected
        ? React.createElement(
            'button',
            {
              type: 'button',
              disabled: disabled || loading,
              onClick: () => selectCharacter(null),
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
        { className: 'truncate' },
        loading
          ? 'Loading…'
          : selected?.name || 'None — optional Character'
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
          characters.length === 0
            ? React.createElement(
                'p',
                { className: 'px-3 py-3 text-[11px] text-white/40' },
                'No Characters yet. Create one in Character Studio.'
              )
            : characters.map((c) =>
                React.createElement(
                  'button',
                  {
                    key: c.id,
                    type: 'button',
                    onClick: () => selectCharacter(c.id),
                    className: `w-full text-left px-3 py-2 text-[12px] hover:bg-white/5 ${
                      selected?.id === c.id ? 'bg-[#22d3ee]/10 text-[#22d3ee]' : 'text-white/80'
                    }`,
                  },
                  React.createElement('div', { className: 'font-semibold truncate' }, c.name),
                  React.createElement(
                    'div',
                    { className: 'text-[9px] uppercase tracking-wider text-white/30' },
                    c.category || 'Character'
                  )
                )
              )
        )
      : null
  );
}
