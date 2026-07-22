'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CAMPAIGN_GOALS } from '../../../lib/dynaxis/campaigns/goals.js';
import { CAMPAIGN_FORMATS } from '../../../lib/dynaxis/campaigns/formats.js';
import {
  createCampaign,
  generateCampaignConcepts,
  selectCampaignConcept,
  updateCampaignConcept,
  createCampaignDeliverables,
  generateCampaignDeliverableBatch,
} from './capability.js';

/**
 * Campaign Studio — Dynaxis shell styling.
 * Brief → Concepts → Formats → Deliverables. No canvas / publishing.
 */
export default function CampaignStudioMiniApp({ runtime }) {
  const [step, setStep] = useState('library'); // library | brief | concepts | formats | results
  const [campaigns, setCampaigns] = useState([]);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [selectedFormatIds, setSelectedFormatIds] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [brief, setBrief] = useState({
    name: '',
    goal: 'brand_awareness',
    direction: '',
    brandId: '',
    productId: '',
    characterId: '',
    includeBrandLogo: false,
  });

  const projectCtx = useMemo(() => {
    try {
      return runtime.getProjectContext();
    } catch {
      return { projectId: null };
    }
  }, [runtime]);

  const refreshLibrary = useCallback(async () => {
    try {
      const data = await runtime.listCampaigns({
        projectId: projectCtx.projectId || undefined,
      });
      setCampaigns(data?.campaigns || []);
    } catch (err) {
      setError(err?.message || 'Failed to load campaigns');
    }
    try {
      const b = await runtime.listBrands();
      setBrands(b?.brands || []);
    } catch {
      setBrands([]);
    }
    try {
      const p = await runtime.listProducts();
      setProducts(p?.products || []);
    } catch {
      setProducts([]);
    }
    try {
      const c = await runtime.listCharacters();
      setCharacters(c?.characters || []);
    } catch {
      setCharacters([]);
    }
    try {
      const t = await runtime.listDesignTemplates?.({ status: 'active', limit: 50 });
      setTemplates(t?.templates || []);
    } catch {
      try {
        const t2 = await runtime.listDesignTemplates?.({ limit: 50 });
        setTemplates(t2?.templates || []);
      } catch {
        setTemplates([]);
      }
    }
  }, [runtime, projectCtx.projectId]);

  const loadCampaign = useCallback(
    async (id) => {
      if (!id) {
        setCampaign(null);
        setConcepts([]);
        setDeliverables([]);
        return;
      }
      try {
        const data = await runtime.getCampaign(id, { includeRelations: 'true' });
        setCampaign(data?.campaign || data);
        const c = await runtime.listCampaignConcepts(id);
        setConcepts(c?.concepts || []);
        const d = await runtime.listCampaignDeliverables(id);
        setDeliverables(d?.deliverables || []);
      } catch (err) {
        setError(err?.message || 'Failed to load campaign');
      }
    },
    [runtime]
  );

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    loadCampaign(selectedId);
  }, [selectedId, loadCampaign]);

  const handleCreate = async () => {
    if (!brief.name.trim() || !brief.brandId) {
      setError('Campaign name and Brand are required');
      return;
    }
    if (!projectCtx.projectId) {
      setError('Active Project is required');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const body = {
        name: brief.name.trim(),
        goal: brief.goal,
        direction: brief.direction || null,
        brandId: brief.brandId,
        projectId: projectCtx.projectId,
        includeBrandLogo: brief.includeBrandLogo,
        productIds: brief.productId
          ? [{ productId: brief.productId }]
          : [],
        characterIds: brief.characterId
          ? [{ characterId: brief.characterId, role: 'presenter' }]
          : [],
      };
      const result = await createCampaign(runtime, body);
      const id = result?.campaign?.id;
      await refreshLibrary();
      if (id) {
        setSelectedId(id);
        setStep('concepts');
        setStatusMessage('Campaign created — generate concepts next');
      }
    } catch (err) {
      setError(err?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateConcepts = async () => {
    if (!selectedId) return;
    try {
      setBusy(true);
      setError(null);
      setStatusMessage('Generating four concepts…');
      const result = await generateCampaignConcepts(runtime, selectedId);
      setConcepts(result?.concepts || []);
      await loadCampaign(selectedId);
      setStatusMessage('Review and select a concept');
    } catch (err) {
      setError(err?.message || 'Concept generation failed');
    } finally {
      setBusy(false);
      setStatusMessage('');
    }
  };

  const handleSelectConcept = async (conceptId) => {
    try {
      setBusy(true);
      await selectCampaignConcept(runtime, selectedId, conceptId);
      await loadCampaign(selectedId);
      setStep('formats');
      setStatusMessage('Concept selected — choose formats');
    } catch (err) {
      setError(err?.message || 'Select failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleFormat = (id) => {
    setSelectedFormatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateDeliverables = async () => {
    const conceptId = campaign?.selectedConceptId;
    if (!conceptId || !selectedFormatIds.length) {
      setError('Select a concept and at least one format');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const result = await createCampaignDeliverables(runtime, selectedId, {
        conceptId,
        formatIds: selectedFormatIds,
        includeBrandLogo: campaign?.includeBrandLogo || brief.includeBrandLogo,
      });
      setDeliverables(result?.deliverables || []);
      setStatusMessage(
        `${result?.generationCount || selectedFormatIds.length} deliverable(s) planned — start generation explicitly`
      );
      setStep('results');
    } catch (err) {
      setError(err?.message || 'Deliverable create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerateBatch = async () => {
    const ids = deliverables
      .filter((d) => d.status === 'planned' || d.status === 'failed' || d.status === 'copy_ready')
      .map((d) => d.id);
    if (!ids.length) {
      setError('No deliverables ready to generate');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setStatusMessage(`Generating ${ids.length} deliverable(s)…`);
      const batch = await generateCampaignDeliverableBatch(runtime, selectedId, ids, {
        concurrency: 2,
      });
      await loadCampaign(selectedId);
      setStatusMessage(
        `Done — ${batch.succeeded} succeeded, ${batch.failed} failed`
      );
    } catch (err) {
      setError(err?.message || 'Batch generation failed');
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    ['library', 'Library'],
    ['brief', 'Brief'],
    ['concepts', 'Concepts'],
    ['formats', 'Formats'],
    ['results', 'Results'],
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
        'Campaign Studio'
      ),
      React.createElement(
        'p',
        { className: 'text-[12px] text-white/40' },
        'Brand-led campaigns · four concepts · multi-format deliverables. No publishing or canvas.'
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
            onClick: () => setStep(id),
            className: `h-8 px-3 rounded-md text-[10px] font-bold uppercase tracking-widest ${
              step === id
                ? 'bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30'
                : 'border border-white/10 text-white/50 hover:text-white/80'
            }`,
          },
          label
        )
      )
    ),
    error
      ? React.createElement('p', { className: 'text-[12px] text-amber-300/90' }, error)
      : null,
    statusMessage
      ? React.createElement(
          'p',
          { className: 'text-[12px] text-[#22d3ee]/80' },
          statusMessage
        )
      : null,

    step === 'library'
      ? React.createElement(
          'section',
          { className: 'space-y-2' },
          campaigns.length === 0
            ? React.createElement(
                'p',
                { className: 'text-[12px] text-white/40' },
                'No Campaigns in this Project yet. Create a brief.'
              )
            : campaigns.map((c) =>
                React.createElement(
                  'button',
                  {
                    key: c.id,
                    type: 'button',
                    onClick: () => {
                      setSelectedId(c.id);
                      setStep('concepts');
                    },
                    className:
                      'w-full text-left rounded-md border border-white/10 bg-black/30 px-3 py-3 hover:border-white/20',
                  },
                  React.createElement(
                    'div',
                    { className: 'font-semibold text-[13px] text-white/90' },
                    c.name
                  ),
                  React.createElement(
                    'div',
                    {
                      className:
                        'text-[10px] uppercase tracking-wider text-white/30 mt-1',
                    },
                    `${c.goal} · ${c.status}`
                  )
                )
              )
        )
      : null,

    step === 'brief'
      ? React.createElement(
          'section',
          { className: 'space-y-3 max-w-xl' },
          React.createElement('input', {
            value: brief.name,
            onChange: (e) => setBrief((b) => ({ ...b, name: e.target.value })),
            placeholder: 'Campaign name',
            className:
              'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[12px] text-white/85',
          }),
          React.createElement(
            'select',
            {
              value: brief.goal,
              onChange: (e) => setBrief((b) => ({ ...b, goal: e.target.value })),
              className:
                'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[12px] text-white/80',
            },
            CAMPAIGN_GOALS.map((g) =>
              React.createElement('option', { key: g.id, value: g.id }, g.label)
            )
          ),
          React.createElement(
            'select',
            {
              value: brief.brandId,
              onChange: (e) => setBrief((b) => ({ ...b, brandId: e.target.value })),
              className:
                'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[12px] text-white/80',
            },
            React.createElement('option', { value: '' }, 'Select Brand (required)'),
            brands.map((b) =>
              React.createElement('option', { key: b.id, value: b.id }, b.name)
            )
          ),
          React.createElement(
            'select',
            {
              value: brief.productId,
              onChange: (e) => setBrief((b) => ({ ...b, productId: e.target.value })),
              className:
                'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[12px] text-white/80',
            },
            React.createElement('option', { value: '' }, 'Product (optional)'),
            products.map((p) =>
              React.createElement('option', { key: p.id, value: p.id }, p.name)
            )
          ),
          React.createElement(
            'select',
            {
              value: brief.characterId,
              onChange: (e) =>
                setBrief((b) => ({ ...b, characterId: e.target.value })),
              className:
                'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[12px] text-white/80',
            },
            React.createElement('option', { value: '' }, 'Character (optional)'),
            characters.map((c) =>
              React.createElement('option', { key: c.id, value: c.id }, c.name)
            )
          ),
          React.createElement('textarea', {
            value: brief.direction,
            onChange: (e) =>
              setBrief((b) => ({ ...b, direction: e.target.value })),
            placeholder: 'Optional direction / brief notes',
            rows: 3,
            className:
              'w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/85',
          }),
          React.createElement(
            'label',
            { className: 'flex items-center gap-2 text-[10px] text-white/50' },
            React.createElement('input', {
              type: 'checkbox',
              checked: brief.includeBrandLogo,
              onChange: (e) =>
                setBrief((b) => ({ ...b, includeBrandLogo: e.target.checked })),
            }),
            'Include brand logo as image reference when generating'
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              disabled: busy,
              onClick: handleCreate,
              className:
                'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-40',
            },
            busy ? 'Creating…' : 'Create Campaign'
          )
        )
      : null,

    step === 'concepts'
      ? React.createElement(
          'section',
          { className: 'space-y-3' },
          !selectedId
            ? React.createElement(
                'p',
                { className: 'text-[12px] text-white/40' },
                'Select or create a Campaign first.'
              )
            : React.createElement(
                React.Fragment,
                null,
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    disabled: busy,
                    onClick: handleGenerateConcepts,
                    className:
                      'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-40',
                  },
                  busy ? 'Generating…' : 'Generate 4 concepts'
                ),
                concepts.map((c) =>
                  React.createElement(
                    'div',
                    {
                      key: c.id,
                      className:
                        'rounded-md border border-white/10 bg-black/30 p-3 space-y-2',
                    },
                    React.createElement(
                      'div',
                      { className: 'font-semibold text-[13px] text-white/90' },
                      c.title
                    ),
                    React.createElement(
                      'p',
                      { className: 'text-[11px] text-white/50' },
                      c.theme
                    ),
                    React.createElement(
                      'p',
                      { className: 'text-[11px] text-white/40' },
                      `Hook: ${c.hook} · CTA: ${c.cta}`
                    ),
                    React.createElement(
                      'div',
                      { className: 'flex gap-2' },
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          disabled: busy,
                          onClick: () => handleSelectConcept(c.id),
                          className:
                            'h-8 px-3 rounded-md border border-[#22d3ee]/40 text-[#22d3ee] text-[10px] font-bold uppercase',
                        },
                        c.status === 'selected' ? 'Selected' : 'Select'
                      ),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          disabled: busy,
                          onClick: async () => {
                            const title = window.prompt('Edit title', c.title);
                            if (!title) return;
                            await updateCampaignConcept(runtime, selectedId, c.id, {
                              title,
                            });
                            await loadCampaign(selectedId);
                          },
                          className:
                            'h-8 px-3 rounded-md border border-white/10 text-white/50 text-[10px] font-bold uppercase',
                        },
                        'Edit title'
                      )
                    )
                  )
                )
              )
        )
      : null,

    step === 'formats'
      ? React.createElement(
          'section',
          { className: 'space-y-3' },
          React.createElement(
            'p',
            { className: 'text-[11px] text-white/40' },
            'Select formats to plan. Generation starts only when you confirm.'
          ),
          CAMPAIGN_FORMATS.map((f) =>
            React.createElement(
              'label',
              {
                key: f.id,
                className:
                  'flex items-start gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/80',
              },
              React.createElement('input', {
                type: 'checkbox',
                checked: selectedFormatIds.includes(f.id),
                onChange: () => toggleFormat(f.id),
              }),
              React.createElement(
                'span',
                null,
                React.createElement('span', { className: 'font-semibold' }, f.label),
                React.createElement(
                  'span',
                  { className: 'block text-[10px] text-white/35' },
                  `${f.aspectRatio} · H${f.headlineMaxWords}/B${f.bodyMaxWords}/C${f.ctaMaxWords}`
                )
              )
            )
          ),
          React.createElement(
            'p',
            { className: 'text-[11px] text-[#22d3ee]/80' },
            `${selectedFormatIds.length} format(s) → ${selectedFormatIds.length} deliverable(s) / image generation(s)`
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              disabled: busy || !selectedFormatIds.length,
              onClick: handleCreateDeliverables,
              className:
                'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-40',
            },
            'Plan deliverables'
          )
        )
      : null,

    step === 'results'
      ? React.createElement(
          'section',
          { className: 'space-y-3' },
          React.createElement(
            'button',
            {
              type: 'button',
              disabled: busy || !deliverables.length,
              onClick: handleGenerateBatch,
              className:
                'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-[11px] font-black uppercase tracking-widest disabled:opacity-40',
            },
            busy ? 'Generating…' : 'Generate selected deliverables'
          ),
          deliverables.map((d) =>
            React.createElement(
              'div',
              {
                key: d.id,
                className:
                  'rounded-md border border-white/10 bg-black/30 p-3 space-y-1',
              },
              React.createElement(
                'div',
                { className: 'text-[12px] font-semibold text-white/85' },
                `${d.formatId} · ${d.status}`
              ),
              d.headline
                ? React.createElement(
                    'p',
                    { className: 'text-[11px] text-white/60' },
                    d.headline
                  )
                : null,
              d.body
                ? React.createElement(
                    'p',
                    { className: 'text-[11px] text-white/40' },
                    d.body
                  )
                : null,
              d.cta
                ? React.createElement(
                    'p',
                    { className: 'text-[10px] text-[#22d3ee]/70' },
                    d.cta
                  )
                : null,
              d.errorMessage
                ? React.createElement(
                    'p',
                    { className: 'text-[10px] text-amber-300/80' },
                    d.errorMessage
                  )
                : null,
              d.assetId
                ? React.createElement(
                    'p',
                    { className: 'text-[10px] text-white/30' },
                    `Asset: ${d.assetId}`
                  )
                : null,
              d.status === 'completed' && d.assetId
                ? React.createElement(
                    'div',
                    { className: 'mt-2 space-y-2' },
                    templates.length
                      ? React.createElement(
                          'label',
                          { className: 'block text-[10px] text-white/40' },
                          'Optional Design Template',
                          React.createElement(
                            'select',
                            {
                              className:
                                'mt-1 w-full h-8 bg-black/40 border border-white/15 rounded px-2 text-[11px] text-white',
                              value: selectedTemplateId,
                              onChange: (e) => setSelectedTemplateId(e.target.value),
                            },
                            React.createElement('option', { value: '' }, 'Default layout'),
                            templates.map((t) =>
                              React.createElement(
                                'option',
                                { key: t.id, value: t.id },
                                t.name
                              )
                            )
                          )
                        )
                      : null,
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className:
                          'h-8 px-3 rounded border border-[#22d3ee]/40 text-[#22d3ee] text-[10px] font-bold uppercase tracking-widest',
                        onClick: () => {
                          const q = new URLSearchParams({ deliverableId: d.id });
                          if (selectedTemplateId) q.set('selectedTemplateId', selectedTemplateId);
                          window.location.href = `/studio/apps/dynaxis.creative-editor?${q}`;
                        },
                      },
                      'Edit in Creative Editor'
                    )
                  )
                : null
            )
          )
        )
      : null
  );
}
