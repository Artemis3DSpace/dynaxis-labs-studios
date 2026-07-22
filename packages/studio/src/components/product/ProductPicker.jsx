'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPlatformClient } from '../../../../../lib/dynaxis/client/platform-api.js';
import { readProjectContext } from '../../../../../lib/dynaxis/client/project-context.js';
import {
  resolveProductContext,
  clearProductGenerationContext,
  publishProductGenerationContext,
} from '../../../../../lib/dynaxis/products/consumer.js';

/**
 * Minimal Dynaxis Product picker for Studios.
 * Does not mutate Products. Does not redesign shell layouts.
 */
export default function ProductPicker({
  apiKey,
  value = null,
  onChange,
  onContextResolved,
  label = 'Product',
  compact = false,
  disabled = false,
  consumer = null,
  maxImages = 14,
  selectedAssetIds = null,
  publishContext = true,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!apiKey || apiKey === 'dynaxis-local-preview') {
      setProducts([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const client = createPlatformClient(apiKey);
      const data = await client.listProducts();
      setProducts(data?.products || []);
    } catch (err) {
      setError(err?.message || 'Unable to load Products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectProduct = async (productId) => {
    if (!productId) {
      onChange?.(null);
      onContextResolved?.(null);
      clearProductGenerationContext();
      setOpen(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const client = createPlatformClient(apiKey);
      const projectId = readProjectContext()?.projectId || null;
      const resolved = await resolveProductContext(client, productId, {
        maxImages,
        selectedAssetIds,
        projectId,
        linkToProject: Boolean(projectId),
        consumer,
      });
      if (publishContext) {
        publishProductGenerationContext({
          productId: resolved.provenance.productId,
          productRevisionId: resolved.provenance.productRevisionId,
          referenceAssetIds: resolved.provenance.referenceAssetIds,
        });
      }
      onChange?.(resolved.product);
      onContextResolved?.(resolved);
      setOpen(false);
    } catch (err) {
      setError(err?.message || 'Failed to resolve Product');
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
              onClick: () => selectProduct(null),
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
          : selected?.name || 'None — select a Product'
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
          products.length === 0
            ? React.createElement(
                'p',
                { className: 'px-3 py-3 text-[11px] text-white/40' },
                'No Products yet. Create one in Product Studio.'
              )
            : products.map((p) =>
                React.createElement(
                  'button',
                  {
                    key: p.id,
                    type: 'button',
                    onClick: () => selectProduct(p.id),
                    className: `w-full text-left px-3 py-2 text-[12px] hover:bg-white/5 ${
                      selected?.id === p.id ? 'bg-[#22d3ee]/10 text-[#22d3ee]' : 'text-white/80'
                    }`,
                  },
                  React.createElement('div', { className: 'font-semibold truncate' }, p.name),
                  React.createElement(
                    'div',
                    { className: 'text-[9px] uppercase tracking-wider text-white/30' },
                    p.category || p.productType || 'Product'
                  )
                )
              )
        )
      : null
  );
}
