'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadFile } from 'studio';
import {
  HEADSHOT_ASPECT_RATIOS,
  HEADSHOT_CATEGORIES,
  HEADSHOT_STYLE_EXAMPLES,
} from './presets.js';
import { generateHeadshot } from './capability.js';

async function downloadImage(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, '_blank');
  }
}

/**
 * AI Headshot Mini App UI — Dynaxis shell styling.
 * Domain workflow adapted from SamurAIGPT/ai-headshot-generator.
 */
export default function HeadshotMiniApp({ runtime, apiKey }) {
  const fileInputRef = useRef(null);
  const [category, setCategory] = useState('LinkedIn');
  const [aspectRatio, setAspectRatio] = useState(HEADSHOT_ASPECT_RATIOS[0].value);
  const [referenceUrl, setReferenceUrl] = useState(null);
  const [referenceAssetId, setReferenceAssetId] = useState(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [projectAssets, setProjectAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [projectLabel, setProjectLabel] = useState('Default Project');

  const projectCtx = useMemo(() => {
    try {
      return runtime.getProjectContext();
    } catch {
      return { projectId: null };
    }
  }, [runtime]);

  const refreshAssets = useCallback(async () => {
    try {
      const data = await runtime.listAssets({ limit: 40 });
      const assets = (data?.assets || []).filter((a) => a.type === 'image');
      setProjectAssets(assets);
    } catch {
      setProjectAssets([]);
    }
  }, [runtime]);

  useEffect(() => {
    refreshAssets();
  }, [refreshAssets]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await runtime.listProjects();
        const projects = data?.projects || [];
        const active =
          projects.find((p) => p.id === projectCtx.projectId) ||
          projects.find((p) => p.isDefault) ||
          projects[0];
        if (!cancelled && active) setProjectLabel(active.name);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runtime, projectCtx.projectId]);

  const setPortraitFromUrl = async (url, existingAssetId = null) => {
    if (!url || !/^https?:\/\//i.test(url)) {
      setError('Please provide a valid image URL.');
      return;
    }
    setError(null);
    setReferenceUrl(url);
    if (existingAssetId) {
      setReferenceAssetId(existingAssetId);
      return;
    }
    try {
      const registered = await runtime.registerAsset({
        url,
        type: 'image',
        source: 'uploaded',
        role: 'portrait_reference',
        metadata: { headshotInput: true },
      });
      setReferenceAssetId(registered?.asset?.id || registered?.id || null);
      await refreshAssets();
    } catch (err) {
      // Still allow generation with URL if platform DB unavailable
      setReferenceAssetId(null);
      console.warn('[Headshot] asset register skipped:', err?.message || err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Please upload PNG, JPG, or WebP images.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('File size exceeds 8MB limit.');
      return;
    }
    if (!apiKey || apiKey === 'dynaxis-local-preview') {
      setError('A MuAPI API key is required to upload images.');
      return;
    }
    try {
      setUploading(true);
      setError(null);
      const url = await uploadFile(apiKey, file);
      await setPortraitFromUrl(url);
    } catch (err) {
      setError(err?.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!referenceUrl && !urlDraft) {
      setError('Please provide a reference portrait.');
      return;
    }
    const imageUrl = referenceUrl || urlDraft.trim();
    try {
      setLoading(true);
      setError(null);
      setResults(null);
      setStatusMessage('Preparing portrait session…');

      if (!referenceUrl && urlDraft.trim()) {
        await setPortraitFromUrl(urlDraft.trim());
      }

      setStatusMessage('Generating headshot pack…');
      const outcome = await generateHeadshot(runtime, {
        imageUrl: referenceUrl || imageUrl,
        assetId: referenceAssetId,
        category,
        aspectRatio,
      });

      const urls =
        outcome?.assets?.map((a) => a.url).filter(Boolean) ||
        (Array.isArray(outcome?.providerResult?.outputs)
          ? outcome.providerResult.outputs.filter((u) => typeof u === 'string')
          : outcome?.providerResult?.url
            ? [outcome.providerResult.url]
            : []);

      if (!urls.length && !outcome?.executed) {
        setError(
          outcome?.message ||
            'Generation lifecycle started but MuAPI execution is unavailable. Check platform configuration.'
        );
      } else if (!urls.length) {
        setError('Generation completed without image outputs.');
      } else {
        setResults({
          urls,
          category,
          aspectRatio,
          generationId: outcome?.generation?.id,
          jobId: outcome?.job?.id,
        });
      }
    } catch (err) {
      setError(err?.message || 'Headshot generation failed.');
    } finally {
      setLoading(false);
      setStatusMessage('');
      refreshAssets();
    }
  };

  const clearReference = () => {
    setReferenceUrl(null);
    setReferenceAssetId(null);
    setUrlDraft('');
  };

  return React.createElement(
    'div',
    {
      className:
        'h-full w-full bg-[#050505] text-white flex flex-col lg:flex-row overflow-hidden',
    },
    // Controls
    React.createElement(
      'aside',
      {
        className:
          'w-full lg:w-96 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.06] bg-black/40 overflow-y-auto',
      },
      React.createElement(
        'div',
        { className: 'p-5 border-b border-white/[0.06] space-y-1' },
        React.createElement(
          'p',
          { className: 'text-[10px] font-bold uppercase tracking-widest text-white/30' },
          'Dynaxis module'
        ),
        React.createElement(
          'h1',
          { className: 'text-[16px] font-bold tracking-tight' },
          'AI Headshot'
        ),
        React.createElement(
          'p',
          { className: 'text-[11px] text-white/40' },
          `Project · ${projectLabel}`
        )
      ),
      React.createElement(
        'div',
        { className: 'p-5 space-y-5' },
        // Category
        React.createElement(
          'label',
          { className: 'block space-y-2' },
          React.createElement(
            'span',
            { className: 'text-[11px] font-bold uppercase tracking-wider text-white/35' },
            'Style category'
          ),
          React.createElement(
            'select',
            {
              value: category,
              onChange: (e) => setCategory(e.target.value),
              className:
                'w-full h-10 rounded-md bg-black/50 border border-white/10 px-3 text-[13px] text-white/90',
            },
            HEADSHOT_CATEGORIES.map((c) =>
              React.createElement('option', { key: c, value: c, className: 'bg-[#0a0a0a]' }, c)
            )
          )
        ),
        // Aspect
        React.createElement(
          'label',
          { className: 'block space-y-2' },
          React.createElement(
            'span',
            { className: 'text-[11px] font-bold uppercase tracking-wider text-white/35' },
            'Aspect ratio'
          ),
          React.createElement(
            'select',
            {
              value: aspectRatio,
              onChange: (e) => setAspectRatio(e.target.value),
              className:
                'w-full h-10 rounded-md bg-black/50 border border-white/10 px-3 text-[13px] text-white/90',
            },
            HEADSHOT_ASPECT_RATIOS.map((r) =>
              React.createElement(
                'option',
                { key: r.value, value: r.value, className: 'bg-[#0a0a0a]' },
                r.label
              )
            )
          )
        ),
        // Reference
        React.createElement(
          'div',
          { className: 'space-y-2' },
          React.createElement(
            'span',
            { className: 'text-[11px] font-bold uppercase tracking-wider text-white/35' },
            'Portrait reference'
          ),
          !referenceUrl
            ? React.createElement(
                'div',
                { className: 'space-y-2' },
                React.createElement(
                  'div',
                  { className: 'flex gap-2' },
                  React.createElement('input', {
                    type: 'text',
                    value: urlDraft,
                    onChange: (e) => setUrlDraft(e.target.value),
                    placeholder: 'Image URL…',
                    className:
                      'flex-1 h-10 rounded-md bg-black/50 border border-white/10 px-3 text-[12px] text-white/90 placeholder:text-white/25',
                  }),
                  React.createElement('input', {
                    type: 'file',
                    ref: fileInputRef,
                    hidden: true,
                    accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
                    onChange: handleFileUpload,
                  }),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      onClick: () => fileInputRef.current?.click(),
                      disabled: uploading,
                      className:
                        'h-10 px-3 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[11px] font-bold disabled:opacity-40',
                    },
                    uploading ? '…' : 'Upload'
                  )
                ),
                urlDraft
                  ? React.createElement(
                      'button',
                      {
                        type: 'button',
                        onClick: () => setPortraitFromUrl(urlDraft.trim()),
                        className:
                          'w-full h-9 rounded-md border border-white/10 text-[11px] font-semibold text-white/70 hover:bg-white/5',
                      },
                      'Use URL'
                    )
                  : null,
                projectAssets.length > 0
                  ? React.createElement(
                      'div',
                      { className: 'pt-2 space-y-2' },
                      React.createElement(
                        'p',
                        {
                          className:
                            'text-[10px] font-bold uppercase tracking-widest text-white/30',
                        },
                        'From project assets'
                      ),
                      React.createElement(
                        'div',
                        { className: 'grid grid-cols-4 gap-2' },
                        projectAssets.slice(0, 8).map((asset) =>
                          React.createElement(
                            'button',
                            {
                              key: asset.id,
                              type: 'button',
                              onClick: () => setPortraitFromUrl(asset.url, asset.id),
                              className:
                                'aspect-square rounded-md overflow-hidden border border-white/10 hover:border-[#22d3ee]/50',
                              title: 'Use project asset',
                            },
                            React.createElement('img', {
                              src: asset.url,
                              alt: '',
                              className: 'w-full h-full object-cover',
                            })
                          )
                        )
                      )
                    )
                  : null
              )
            : React.createElement(
                'div',
                { className: 'relative w-28 aspect-square rounded-lg overflow-hidden border border-[#22d3ee]/30' },
                React.createElement('img', {
                  src: referenceUrl,
                  alt: 'Reference',
                  className: 'w-full h-full object-cover',
                }),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: clearReference,
                    className:
                      'absolute top-1.5 right-1.5 h-7 w-7 rounded-md bg-black/70 text-white/80 text-sm',
                  },
                  '×'
                )
              )
        ),
        error
          ? React.createElement(
              'p',
              { className: 'text-[12px] text-red-400/90 leading-relaxed' },
              error
            )
          : null,
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handleGenerate,
            disabled: loading || (!referenceUrl && !urlDraft.trim()),
            className:
              'w-full h-11 rounded-md bg-[#22d3ee] text-black text-[12px] font-black uppercase tracking-wider disabled:opacity-40 hover:bg-[#67e8f9]',
          },
          loading ? statusMessage || 'Processing…' : 'Generate headshot pack'
        ),
        React.createElement(
          'p',
          { className: 'text-[10px] text-white/30 leading-relaxed' },
          'Adapted from SamurAIGPT AI Headshot Generator (MIT). Auth, Stripe, and standalone billing are not included — Dynaxis owns platform services.'
        )
      )
    ),
    // Canvas
    React.createElement(
      'main',
      { className: 'flex-1 min-h-0 overflow-y-auto p-6 lg:p-10' },
      loading
        ? React.createElement(
            'div',
            { className: 'h-full flex flex-col items-center justify-center gap-4' },
            React.createElement('div', {
              className:
                'w-12 h-12 border-2 border-[#22d3ee]/20 border-t-[#22d3ee] rounded-full animate-spin',
            }),
            React.createElement(
              'p',
              { className: 'text-[12px] font-bold uppercase tracking-widest text-white/50' },
              statusMessage || 'Working…'
            )
          )
        : results
          ? React.createElement(
              'div',
              { className: 'space-y-5' },
              React.createElement(
                'div',
                { className: 'flex items-center justify-between gap-3 flex-wrap' },
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'h2',
                    { className: 'text-[15px] font-bold' },
                    `${results.category} pack`
                  ),
                  React.createElement(
                    'p',
                    { className: 'text-[11px] text-white/40' },
                    `${results.urls.length} images · ${results.aspectRatio}`
                  )
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: async () => {
                      for (let i = 0; i < results.urls.length; i += 1) {
                        await downloadImage(
                          results.urls[i],
                          `headshot-${results.category}-${i + 1}.jpg`
                        );
                      }
                    },
                    className:
                      'h-9 px-4 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[11px] font-bold',
                  },
                  'Download pack'
                )
              ),
              React.createElement(
                'div',
                { className: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3' },
                results.urls.map((url, idx) =>
                  React.createElement(
                    'div',
                    {
                      key: `${url}-${idx}`,
                      className:
                        'relative group aspect-[3/4] rounded-lg overflow-hidden border border-white/10 bg-black/40',
                    },
                    React.createElement('img', {
                      src: url,
                      alt: '',
                      className: 'w-full h-full object-cover',
                    }),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        onClick: () =>
                          downloadImage(url, `headshot-${results.category}-${idx + 1}.jpg`),
                        className:
                          'absolute bottom-2 right-2 h-8 px-2 rounded-md bg-black/70 text-[10px] font-bold text-white opacity-0 group-hover:opacity-100',
                      },
                      'Save'
                    )
                  )
                )
              )
            )
          : React.createElement(
              'div',
              { className: 'h-full flex flex-col items-center justify-center gap-8' },
              React.createElement(
                'div',
                { className: 'text-center max-w-md space-y-2' },
                React.createElement(
                  'h2',
                  { className: 'text-[15px] font-bold tracking-tight' },
                  'Portrait studio ready'
                ),
                React.createElement(
                  'p',
                  { className: 'text-[12px] text-white/40 leading-relaxed' },
                  'Upload a clear face reference, choose a professional style, and generate a multi-image headshot pack into your Dynaxis project.'
                )
              ),
              React.createElement(
                'div',
                { className: 'flex gap-3 overflow-x-auto max-w-full pb-2' },
                HEADSHOT_STYLE_EXAMPLES.map((ex) =>
                  React.createElement(
                    'div',
                    {
                      key: ex.name,
                      className:
                        'w-28 flex-shrink-0 aspect-[3/4] rounded-lg overflow-hidden border border-white/10 relative',
                    },
                    React.createElement('img', {
                      src: ex.url,
                      alt: ex.name,
                      className: 'w-full h-full object-cover',
                    }),
                    React.createElement(
                      'span',
                      {
                        className:
                          'absolute bottom-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wider bg-black/60 px-1.5 py-0.5 rounded',
                      },
                      ex.name
                    )
                  )
                )
              )
            )
    )
  );
}
