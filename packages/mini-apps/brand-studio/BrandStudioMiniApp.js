'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBrand,
  updateBrand,
  analyzeBrandWebsite,
  saveBrandDraft,
} from './capability.js';

function joinList(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

const EMPTY_FORM = {
  name: '',
  industry: '',
  tagline: '',
  valueProposition: '',
  targetAudience: '',
  toneOfVoice: '',
  brandPersonality: '',
  keyMessages: '',
  primaryColors: '',
  secondaryColors: '',
  fonts: '',
  imageryStyle: '',
  layoutStyle: '',
  sourceUrl: '',
};

function formFromBrand(brand) {
  if (!brand) return { ...EMPTY_FORM };
  return {
    name: brand.name || '',
    industry: brand.industry || '',
    tagline: brand.tagline || '',
    valueProposition: brand.valueProposition || '',
    targetAudience: brand.targetAudience || '',
    toneOfVoice: joinList(brand.toneOfVoice),
    brandPersonality: joinList(brand.brandPersonality),
    keyMessages: joinList(brand.keyMessages),
    primaryColors: joinList(brand.primaryColors),
    secondaryColors: joinList(brand.secondaryColors),
    fonts: joinList(
      (brand.fonts || []).map((f) => (typeof f === 'string' ? f : f?.family || f?.name || ''))
    ),
    imageryStyle: brand.imageryStyle || '',
    layoutStyle: brand.layoutStyle || '',
    sourceUrl: brand.sourceUrl || '',
  };
}

function formFromDraft(draft) {
  return formFromBrand(draft || {});
}

/**
 * Brand Studio — Dynaxis shell styling.
 * Manual DNA editing + secure website analysis draft review.
 */
export default function BrandStudioMiniApp({ runtime }) {
  const [tab, setTab] = useState('library'); // library | create | analyze | edit
  const [brands, setBrands] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [brandAssets, setBrandAssets] = useState([]);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [draft, setDraft] = useState(null);
  const [sourceSnapshot, setSourceSnapshot] = useState(null);

  const projectCtx = useMemo(() => {
    try {
      return runtime.getProjectContext();
    } catch {
      return { projectId: null };
    }
  }, [runtime]);

  const refreshLibrary = useCallback(async () => {
    try {
      const data = await runtime.listBrands();
      setBrands(data?.brands || []);
    } catch (err) {
      setError(err?.message || 'Failed to load brands');
    }
  }, [runtime]);

  const loadBrand = useCallback(
    async (id) => {
      if (!id) {
        setSelected(null);
        setBrandAssets([]);
        return;
      }
      try {
        const data = await runtime.getBrand(id, { includeAssets: 'true' });
        const brand = data?.brand || data;
        setSelected(brand);
        setForm(formFromBrand(brand));
        const assetsRes = await runtime.listBrandAssets(id);
        setBrandAssets(assetsRes?.assets || []);
      } catch (err) {
        setError(err?.message || 'Failed to load brand');
      }
    },
    [runtime]
  );

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    loadBrand(selectedId);
  }, [selectedId, loadBrand]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleCreate = async () => {
    try {
      setBusy(true);
      setError(null);
      const result = await createBrand(runtime, {
        ...form,
        projectId: projectCtx.projectId || undefined,
      });
      const brand = result?.brand;
      await refreshLibrary();
      if (brand?.id) {
        setSelectedId(brand.id);
        setTab('edit');
      }
      setStatusMessage('Brand created');
      setForm({ ...EMPTY_FORM });
    } catch (err) {
      setError(err?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedId) return;
    try {
      setBusy(true);
      setError(null);
      await updateBrand(runtime, selectedId, form);
      await loadBrand(selectedId);
      await refreshLibrary();
      setStatusMessage('Brand updated — new revision saved');
    } catch (err) {
      setError(err?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAnalyze = async () => {
    try {
      setBusy(true);
      setError(null);
      setStatusMessage('');
      const result = await analyzeBrandWebsite(runtime, analyzeUrl);
      setDraft(result?.draft || null);
      setSourceSnapshot(result?.sourceSnapshot || null);
      setForm(formFromDraft(result?.draft));
      setStatusMessage('Draft ready — review and save');
    } catch (err) {
      setError(err?.message || 'Website analysis failed');
      setDraft(null);
      setSourceSnapshot(null);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setBusy(true);
      setError(null);
      const result = await saveBrandDraft(runtime, form, {
        brandId: selectedId || undefined,
        projectId: projectCtx.projectId || undefined,
      });
      const brand = result?.brand;
      await refreshLibrary();
      if (brand?.id) {
        setSelectedId(brand.id);
        setTab('edit');
        await loadBrand(brand.id);
      }
      setDraft(null);
      setStatusMessage('Brand DNA saved as revision');
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, multiline = false) =>
    React.createElement(
      'label',
      { key, className: 'block space-y-1' },
      React.createElement(
        'span',
        { className: 'text-[10px] font-bold uppercase tracking-widest text-white/35' },
        label
      ),
      multiline
        ? React.createElement('textarea', {
            value: form[key] || '',
            onChange: (e) => setField(key, e.target.value),
            rows: 3,
            className:
              'w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/85',
          })
        : React.createElement('input', {
            value: form[key] || '',
            onChange: (e) => setField(key, e.target.value),
            className:
              'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[12px] text-white/85',
          })
    );

  const tabs = [
    ['library', 'Library'],
    ['create', 'Create'],
    ['analyze', 'Analyze URL'],
    ['edit', 'Edit'],
  ];

  return React.createElement(
    'div',
    { className: 'w-full max-w-4xl mx-auto px-4 py-6 space-y-5' },
    React.createElement(
      'header',
      { className: 'space-y-1' },
      React.createElement(
        'h1',
        { className: 'text-xl font-black uppercase tracking-tight text-white' },
        'Brand Studio'
      ),
      React.createElement(
        'p',
        { className: 'text-[12px] text-white/40' },
        'Persistent Brand DNA — manual entry or secure website analysis. Campaigns not included.'
      )
    ),
    React.createElement(
      'div',
      { className: 'flex flex-wrap gap-2' },
      tabs.map(([id, label]) =>
        React.createElement(
          'button',
          {
            key: id,
            type: 'button',
            onClick: () => setTab(id),
            className: `h-8 px-3 rounded-md text-[10px] font-bold uppercase tracking-widest ${
              tab === id
                ? 'bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30'
                : 'border border-white/10 text-white/50 hover:text-white/80'
            }`,
          },
          label
        )
      )
    ),
    error
      ? React.createElement(
          'p',
          { className: 'text-[12px] text-amber-300/90' },
          error
        )
      : null,
    statusMessage
      ? React.createElement(
          'p',
          { className: 'text-[12px] text-[#22d3ee]/80' },
          statusMessage
        )
      : null,

    tab === 'library'
      ? React.createElement(
          'section',
          { className: 'space-y-2' },
          brands.length === 0
            ? React.createElement(
                'p',
                { className: 'text-[12px] text-white/40' },
                'No Brands yet. Create manually or analyze a website.'
              )
            : brands.map((b) =>
                React.createElement(
                  'button',
                  {
                    key: b.id,
                    type: 'button',
                    onClick: () => {
                      setSelectedId(b.id);
                      setTab('edit');
                    },
                    className:
                      'w-full text-left rounded-md border border-white/10 bg-black/30 px-3 py-3 hover:border-white/20',
                  },
                  React.createElement(
                    'div',
                    { className: 'font-semibold text-[13px] text-white/90' },
                    b.name
                  ),
                  React.createElement(
                    'div',
                    { className: 'text-[10px] uppercase tracking-wider text-white/30 mt-1' },
                    b.industry || b.tagline || 'Brand'
                  )
                )
              )
        )
      : null,

    tab === 'create'
      ? React.createElement(
          'section',
          { className: 'space-y-3 max-w-xl' },
          field('name', 'Name'),
          field('industry', 'Industry'),
          field('tagline', 'Tagline'),
          field('valueProposition', 'Value proposition', true),
          field('targetAudience', 'Target audience', true),
          field('toneOfVoice', 'Tone of voice (comma-separated)'),
          field('brandPersonality', 'Personality (comma-separated)'),
          field('keyMessages', 'Key messages (comma-separated)', true),
          field('primaryColors', 'Primary colours (#rrggbb)'),
          field('secondaryColors', 'Secondary colours'),
          field('fonts', 'Fonts (comma-separated)'),
          field('imageryStyle', 'Imagery style', true),
          field('layoutStyle', 'Layout style', true),
          React.createElement(
            'button',
            {
              type: 'button',
              disabled: busy,
              onClick: handleCreate,
              className:
                'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-40',
            },
            busy ? 'Saving…' : 'Create Brand'
          )
        )
      : null,

    tab === 'analyze'
      ? React.createElement(
          'section',
          { className: 'space-y-3 max-w-xl' },
          React.createElement(
            'p',
            { className: 'text-[11px] text-white/40' },
            'Analysis runs on the Dynaxis server with SSRF protections. Playwright may be unavailable in some environments — manual create still works.'
          ),
          React.createElement('input', {
            value: analyzeUrl,
            onChange: (e) => setAnalyzeUrl(e.target.value),
            placeholder: 'https://example.com',
            className:
              'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[12px] text-white/85',
          }),
          React.createElement(
            'button',
            {
              type: 'button',
              disabled: busy || !analyzeUrl.trim(),
              onClick: handleAnalyze,
              className:
                'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-40',
            },
            busy ? 'Analyzing…' : 'Analyze website'
          ),
          draft
            ? React.createElement(
                'div',
                { className: 'space-y-3 border-t border-white/10 pt-4' },
                React.createElement(
                  'p',
                  { className: 'text-[10px] font-bold uppercase tracking-widest text-white/35' },
                  'Review draft DNA'
                ),
                sourceSnapshot?.title
                  ? React.createElement(
                      'p',
                      { className: 'text-[11px] text-white/50' },
                      `Source: ${sourceSnapshot.title}`
                    )
                  : null,
                field('name', 'Name'),
                field('industry', 'Industry'),
                field('tagline', 'Tagline'),
                field('valueProposition', 'Value proposition', true),
                field('targetAudience', 'Target audience', true),
                field('toneOfVoice', 'Tone of voice'),
                field('brandPersonality', 'Personality'),
                field('keyMessages', 'Key messages', true),
                field('primaryColors', 'Primary colours'),
                field('secondaryColors', 'Secondary colours'),
                field('fonts', 'Fonts'),
                field('imageryStyle', 'Imagery style', true),
                field('layoutStyle', 'Layout style', true),
                field('sourceUrl', 'Source URL'),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    disabled: busy,
                    onClick: handleSaveDraft,
                    className:
                      'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-40',
                  },
                  busy ? 'Saving…' : 'Save Brand revision'
                )
              )
            : null
        )
      : null,

    tab === 'edit'
      ? React.createElement(
          'section',
          { className: 'space-y-3 max-w-xl' },
          !selectedId
            ? React.createElement(
                'p',
                { className: 'text-[12px] text-white/40' },
                'Select a Brand from the library first.'
              )
            : React.createElement(
                React.Fragment,
                null,
                field('name', 'Name'),
                field('industry', 'Industry'),
                field('tagline', 'Tagline'),
                field('valueProposition', 'Value proposition', true),
                field('targetAudience', 'Target audience', true),
                field('toneOfVoice', 'Tone of voice'),
                field('brandPersonality', 'Personality'),
                field('keyMessages', 'Key messages', true),
                field('primaryColors', 'Primary colours'),
                field('secondaryColors', 'Secondary colours'),
                field('fonts', 'Fonts'),
                field('imageryStyle', 'Imagery style', true),
                field('layoutStyle', 'Layout style', true),
                field('sourceUrl', 'Source URL'),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    disabled: busy,
                    onClick: handleSaveEdit,
                    className:
                      'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-40',
                  },
                  busy ? 'Saving…' : 'Save new revision'
                ),
                brandAssets.length
                  ? React.createElement(
                      'div',
                      { className: 'pt-3 space-y-1' },
                      React.createElement(
                        'p',
                        {
                          className:
                            'text-[10px] font-bold uppercase tracking-widest text-white/35',
                        },
                        'Brand assets'
                      ),
                      brandAssets.map((a) =>
                        React.createElement(
                          'div',
                          {
                            key: a.assetId || a.id,
                            className: 'text-[11px] text-white/50 truncate',
                          },
                          `${a.role || 'brand_reference'} · ${a.assetId || a.asset?.id || ''}`
                        )
                      )
                    )
                  : null
              )
        )
      : null
  );
}
