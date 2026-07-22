'use client';

import React from 'react';

/**
 * Select which Product reference Assets feed a generation.
 * Authoritative selection is Asset IDs. Respects maxImages.
 */
export default function ProductReferencePicker({
  assets = [],
  selectedAssetIds = [],
  onChange,
  maxImages = 14,
  disabled = false,
  label = 'Product references',
}) {
  const list = (assets || []).filter((a) => a.url);

  const toggle = (assetId) => {
    if (disabled || !assetId) return;
    const set = new Set(selectedAssetIds || []);
    if (set.has(assetId)) {
      set.delete(assetId);
    } else {
      if (set.size >= maxImages) {
        const arr = [...set];
        arr.shift();
        set.clear();
        arr.forEach((id) => set.add(id));
      }
      set.add(assetId);
    }
    onChange?.([...set]);
  };

  if (!list.length) {
    return React.createElement(
      'p',
      { className: 'text-[11px] text-white/35' },
      'No Product reference images. Add references in Product Studio first.'
    );
  }

  return React.createElement(
    'div',
    { className: 'space-y-2' },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between' },
      React.createElement(
        'span',
        { className: 'text-[10px] font-bold uppercase tracking-widest text-white/35' },
        label
      ),
      React.createElement(
        'span',
        { className: 'text-[10px] text-white/30' },
        `${(selectedAssetIds || []).length}/${maxImages}`
      )
    ),
    React.createElement(
      'div',
      { className: 'flex flex-wrap gap-2' },
      list.map((asset) => {
        const selected = (selectedAssetIds || []).includes(asset.assetId);
        return React.createElement(
          'button',
          {
            key: asset.assetId || asset.url,
            type: 'button',
            disabled: disabled,
            onClick: () => toggle(asset.assetId),
            title: asset.role,
            className: `relative w-14 h-14 rounded-md overflow-hidden border ${
              selected
                ? 'border-[#22d3ee]/60 ring-1 ring-[#22d3ee]/30'
                : 'border-white/10 hover:border-white/25'
            }`,
          },
          React.createElement('img', {
            src: asset.url,
            alt: asset.role,
            className: 'w-full h-full object-cover',
          }),
          React.createElement(
            'span',
            {
              className:
                'absolute bottom-0 inset-x-0 bg-black/60 text-[7px] uppercase tracking-wider text-white/70 py-0.5 text-center truncate',
            },
            asset.role?.replace(/_/g, ' ') || 'ref'
          )
        );
      })
    )
  );
}
