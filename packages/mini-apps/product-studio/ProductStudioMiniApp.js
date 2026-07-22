'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadFile } from 'studio';
import {
  PRODUCT_ASPECT_RATIOS,
  PRODUCT_SCENE_PRESETS,
  MAX_PRODUCT_REFERENCE_IMAGES,
  DEFAULT_SCENE_PRESET,
  getScenePresetByName,
} from './presets.js';
import {
  generateProductScene,
  promoteProductReference,
} from './capability.js';

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
 * Product Studio — Dynaxis shell styling.
 * Domain: persistent Products + nano-banana-2-edit scene photography.
 */
export default function ProductStudioMiniApp({ runtime, apiKey }) {
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('library'); // library | create | generate
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [productAssets, setProductAssets] = useState([]);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    visualDescription: '',
    brandName: '',
    category: '',
    productType: 'physical',
    sku: '',
  });

  const [scenePreset, setScenePreset] = useState(DEFAULT_SCENE_PRESET);
  const [customPrompt, setCustomPrompt] = useState(
    () => getScenePresetByName(DEFAULT_SCENE_PRESET)?.prompt || ''
  );
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [pendingRefs, setPendingRefs] = useState([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [results, setResults] = useState(null);
  const [brands, setBrands] = useState([]);
  const [linkedBrandId, setLinkedBrandId] = useState(null);
  const [includeBrandLogo, setIncludeBrandLogo] = useState(false);

  const projectCtx = useMemo(() => {
    try {
      return runtime.getProjectContext();
    } catch {
      return { projectId: null };
    }
  }, [runtime]);

  const refreshLibrary = useCallback(async () => {
    try {
      const data = await runtime.listProducts();
      setProducts(data?.products || []);
    } catch (err) {
      setError(err?.message || 'Failed to load products');
    }
    try {
      const brandData = await runtime.listBrands();
      setBrands(brandData?.brands || []);
    } catch {
      setBrands([]);
    }
  }, [runtime]);

  const loadProduct = useCallback(
    async (id) => {
      if (!id) {
        setSelected(null);
        setProductAssets([]);
        setSelectedAssetIds([]);
        setLinkedBrandId(null);
        return;
      }
      try {
        const data = await runtime.getProduct(id, { includeAssets: 'true' });
        const product = data?.product || data;
        setSelected(product);
        const assetsRes = await runtime.listProductAssets(id);
        const links = assetsRes?.assets || [];
        setProductAssets(links);
        const identity = links
          .filter((l) =>
            [
              'product_reference',
              'transparent_product_reference',
              'packaging_reference',
              'label_reference',
              'detail_reference',
              'logo_reference',
            ].includes(l.role)
          )
          .map((l) => l.assetId || l.asset?.id)
          .filter(Boolean);
        setSelectedAssetIds(identity.slice(0, MAX_PRODUCT_REFERENCE_IMAGES));
        try {
          const linked = await runtime.listProductBrands(id);
          const primary =
            (linked?.brands || linked || []).find((b) => b.isPrimary) ||
            (linked?.brands || linked || [])[0];
          setLinkedBrandId(primary?.brandId || primary?.id || null);
        } catch {
          setLinkedBrandId(null);
        }
      } catch (err) {
        setError(err?.message || 'Failed to load product');
      }
    },
    [runtime]
  );

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    loadProduct(selectedId);
  }, [selectedId, loadProduct]);

  const selectProduct = (id) => {
    setSelectedId(id);
    setResults(null);
    setPendingRefs([]);
    setTab('generate');
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError('Product name is required');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const result = await runtime.createProduct({
        ...form,
        projectId: projectCtx.projectId || undefined,
      });
      const product = result?.product;
      await refreshLibrary();
      if (product?.id) {
        setSelectedId(product.id);
        setTab('generate');
        setForm({
          name: '',
          description: '',
          visualDescription: '',
          brandName: '',
          category: '',
          productType: 'physical',
          sku: '',
        });
      }
    } catch (err) {
      setError(err?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleUploadRefs = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!apiKey || apiKey === 'dynaxis-local-preview') {
      setError('A MuAPI API key is required to upload images.');
      return;
    }
    const currentCount =
      (selectedAssetIds?.length || 0) + pendingRefs.length + files.length;
    if (currentCount > MAX_PRODUCT_REFERENCE_IMAGES) {
      setError(`At most ${MAX_PRODUCT_REFERENCE_IMAGES} reference images.`);
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const next = [...pendingRefs];
      for (const file of files) {
        const url = await uploadFile(apiKey, file);
        const registered = await runtime.registerAsset({
          url,
          type: 'image',
          source: 'uploaded',
          role: 'product_reference',
          metadata: { productStudioInput: true },
        });
        const assetId = registered?.asset?.id || registered?.id || null;
        next.push({ url, assetId });
        if (selectedId && assetId) {
          await runtime.addProductAsset(selectedId, {
            assetId,
            role: 'product_reference',
            createRevision: true,
          });
        }
      }
      setPendingRefs(next);
      if (selectedId) await loadProduct(selectedId);
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePresetSelect = (preset) => {
    setScenePreset(preset.name);
    setCustomPrompt(preset.prompt);
  };

  const handleGenerate = async () => {
    if (!selectedId) {
      setError('Select or create a Product first.');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setStatusMessage('Generating product scene…');
      setResults(null);
      const outcome = await generateProductScene(runtime, {
        productId: selectedId,
        prompt: customPrompt,
        scenePreset,
        aspectRatio,
        selectedAssetIds:
          selectedAssetIds.length > 0 ? selectedAssetIds : null,
        referenceAssets: pendingRefs.map((r) => ({
          url: r.url,
          assetId: r.assetId,
          role: 'product_reference',
        })),
        brandId: linkedBrandId || null,
        includeBrandLogo: includeBrandLogo && Boolean(linkedBrandId),
      });
      const urls =
        outcome?.assets?.map((a) => a.url).filter(Boolean) ||
        (Array.isArray(outcome?.providerResult?.outputs)
          ? outcome.providerResult.outputs.filter((u) => typeof u === 'string')
          : []);
      if (!urls.length && !outcome?.executed) {
        setError(outcome?.message || 'Generation execution unavailable.');
      } else if (!urls.length) {
        setError('Generation completed without image outputs.');
      } else {
        setResults({
          urls,
          assets: outcome?.assets || [],
          generationId: outcome?.generation?.id,
          productRevisionId: outcome?.generation?.productRevisionId,
          scenePreset,
        });
      }
      await loadProduct(selectedId);
    } catch (err) {
      setError(err?.message || 'Scene generation failed');
    } finally {
      setBusy(false);
      setStatusMessage('');
    }
  };

  const handlePromote = async (assetId) => {
    try {
      setBusy(true);
      await promoteProductReference(runtime, selectedId, assetId, {
        role: 'product_reference',
        isPrimary: true,
      });
      await loadProduct(selectedId);
      setStatusMessage('Promoted to Product reference (new revision).');
    } catch (err) {
      setError(err?.message || 'Promote failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleSelectedAsset = (assetId) => {
    if (!assetId) return;
    setSelectedAssetIds((prev) => {
      const set = new Set(prev);
      if (set.has(assetId)) set.delete(assetId);
      else {
        if (set.size >= MAX_PRODUCT_REFERENCE_IMAGES) {
          const arr = [...set];
          arr.shift();
          set.clear();
          arr.forEach((id) => set.add(id));
        }
        set.add(assetId);
      }
      return [...set];
    });
  };

  const tabBtn = (id, label) =>
    React.createElement(
      'button',
      {
        type: 'button',
        key: id,
        onClick: () => setTab(id),
        className: `px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md ${
          tab === id
            ? 'bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30'
            : 'text-white/40 border border-transparent hover:text-white/70'
        }`,
      },
      label
    );

  const identityAssets = productAssets.filter((l) =>
    [
      'product_reference',
      'transparent_product_reference',
      'packaging_reference',
      'label_reference',
      'detail_reference',
      'logo_reference',
    ].includes(l.role)
  );

  return React.createElement(
    'div',
    { className: 'h-full w-full overflow-y-auto bg-[#050505] text-white' },
    React.createElement(
      'div',
      { className: 'max-w-6xl mx-auto px-6 py-8 space-y-6' },
      React.createElement(
        'header',
        { className: 'space-y-2' },
        React.createElement(
          'p',
          {
            className:
              'text-[10px] font-black uppercase tracking-[0.2em] text-[#22d3ee]/70',
          },
          'Dynaxis Mini App'
        ),
        React.createElement(
          'h1',
          { className: 'text-2xl font-black tracking-tight' },
          'Product Studio'
        ),
        React.createElement(
          'p',
          { className: 'text-sm text-white/45 max-w-2xl' },
          'Persistent Products with multi-image references and professional product photography. Scene presets style the Generation — they do not rewrite Product identity.'
        )
      ),
      React.createElement(
        'div',
        { className: 'flex flex-wrap gap-2' },
        tabBtn('library', 'Library'),
        tabBtn('create', 'Create'),
        tabBtn('generate', 'Generate')
      ),
      error
        ? React.createElement(
            'div',
            {
              className:
                'rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200',
            },
            error
          )
        : null,
      statusMessage
        ? React.createElement(
            'p',
            { className: 'text-xs text-[#22d3ee]/80' },
            statusMessage
          )
        : null,

      tab === 'library'
        ? React.createElement(
            'section',
            { className: 'space-y-3' },
            React.createElement(
              'h2',
              {
                className:
                  'text-[10px] font-bold uppercase tracking-widest text-white/35',
              },
              'Product Library'
            ),
            products.length === 0
              ? React.createElement(
                  'p',
                  { className: 'text-sm text-white/40' },
                  'No Products yet. Create one to begin.'
                )
              : React.createElement(
                  'div',
                  { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3' },
                  products.map((p) =>
                    React.createElement(
                      'button',
                      {
                        key: p.id,
                        type: 'button',
                        onClick: () => selectProduct(p.id),
                        className:
                          'text-left rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-[#22d3ee]/40 transition-colors',
                      },
                      React.createElement(
                        'div',
                        { className: 'font-semibold text-sm truncate' },
                        p.name
                      ),
                      React.createElement(
                        'div',
                        {
                          className:
                            'mt-1 text-[10px] uppercase tracking-wider text-white/30',
                        },
                        p.category || p.productType || 'Product'
                      )
                    )
                  )
                )
          )
        : null,

      tab === 'create'
        ? React.createElement(
            'section',
            { className: 'space-y-4 max-w-xl' },
            React.createElement(
              'h2',
              {
                className:
                  'text-[10px] font-bold uppercase tracking-widest text-white/35',
              },
              'New Product'
            ),
            [
              ['name', 'Name', true],
              ['description', 'Description', false],
              ['visualDescription', 'Visual description', false],
              ['brandName', 'Brand name (metadata)', false],
              ['category', 'Category', false],
              ['sku', 'SKU (optional)', false],
            ].map(([key, label, required]) =>
              React.createElement(
                'label',
                { key, className: 'block space-y-1' },
                React.createElement(
                  'span',
                  {
                    className:
                      'text-[10px] font-bold uppercase tracking-widest text-white/35',
                  },
                  label
                ),
                React.createElement(key === 'description' || key === 'visualDescription' ? 'textarea' : 'input', {
                  value: form[key],
                  required,
                  rows: key === 'description' || key === 'visualDescription' ? 3 : undefined,
                  onChange: (e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value })),
                  className:
                    'w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90',
                })
              )
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                disabled: busy,
                onClick: handleCreate,
                className:
                  'h-10 px-4 rounded-md bg-[#22d3ee] text-black text-xs font-black uppercase tracking-widest disabled:opacity-40',
              },
              busy ? 'Creating…' : 'Create Product'
            )
          )
        : null,

      tab === 'generate'
        ? React.createElement(
            'section',
            { className: 'grid grid-cols-1 lg:grid-cols-2 gap-8' },
            React.createElement(
              'div',
              { className: 'space-y-5' },
              React.createElement(
                'div',
                { className: 'space-y-1' },
                React.createElement(
                  'span',
                  {
                    className:
                      'text-[10px] font-bold uppercase tracking-widest text-white/35',
                  },
                  'Active Product'
                ),
                React.createElement(
                  'p',
                  { className: 'text-sm font-semibold' },
                  selected?.name || 'Select a Product from Library'
                ),
                selected?.currentRevisionId
                  ? React.createElement(
                      'p',
                      { className: 'text-[10px] text-white/30' },
                      `Revision ${selected.currentRevisionId.slice(0, 8)}…`
                    )
                  : null
              ),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                React.createElement(
                  'span',
                  {
                    className:
                      'text-[10px] font-bold uppercase tracking-widest text-white/35',
                  },
                  'Brand (optional)'
                ),
                React.createElement(
                  'select',
                  {
                    value: linkedBrandId || '',
                    disabled: busy || !selectedId,
                    onChange: async (e) => {
                      const next = e.target.value || null;
                      try {
                        setBusy(true);
                        if (linkedBrandId && linkedBrandId !== next) {
                          await runtime.unlinkProductFromBrand(
                            selectedId,
                            linkedBrandId
                          );
                        }
                        if (next) {
                          await runtime.linkProductToBrand(selectedId, {
                            brandId: next,
                            isPrimary: true,
                          });
                        }
                        setLinkedBrandId(next);
                        if (!next) setIncludeBrandLogo(false);
                      } catch (err) {
                        setError(err?.message || 'Brand link failed');
                      } finally {
                        setBusy(false);
                      }
                    },
                    className:
                      'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-[12px] text-white/80',
                  },
                  React.createElement('option', { value: '' }, 'None'),
                  brands.map((b) =>
                    React.createElement(
                      'option',
                      { key: b.id, value: b.id },
                      b.name
                    )
                  )
                ),
                linkedBrandId
                  ? React.createElement(
                      'label',
                      {
                        className:
                          'flex items-center gap-2 text-[10px] text-white/50',
                      },
                      React.createElement('input', {
                        type: 'checkbox',
                        checked: includeBrandLogo,
                        onChange: (e) => setIncludeBrandLogo(e.target.checked),
                      }),
                      'Include brand logo as generation reference'
                    )
                  : null
              ),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                React.createElement(
                  'div',
                  { className: 'flex items-center justify-between' },
                  React.createElement(
                    'span',
                    {
                      className:
                        'text-[10px] font-bold uppercase tracking-widest text-white/35',
                    },
                    'References'
                  ),
                  React.createElement(
                    'span',
                    { className: 'text-[10px] text-white/30' },
                    `${selectedAssetIds.length}/${MAX_PRODUCT_REFERENCE_IMAGES}`
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'flex flex-wrap gap-2' },
                  identityAssets.map((link) => {
                    const assetId = link.assetId || link.asset?.id;
                    const url = link.asset?.url || link.url;
                    const on = selectedAssetIds.includes(assetId);
                    return React.createElement(
                      'button',
                      {
                        key: assetId || url,
                        type: 'button',
                        onClick: () => toggleSelectedAsset(assetId),
                        className: `relative w-16 h-16 rounded-md overflow-hidden border ${
                          on
                            ? 'border-[#22d3ee]/60 ring-1 ring-[#22d3ee]/30'
                            : 'border-white/10'
                        }`,
                      },
                      url
                        ? React.createElement('img', {
                            src: url,
                            alt: link.role,
                            className: 'w-full h-full object-cover',
                          })
                        : null
                    );
                  }),
                  pendingRefs.map((r, i) =>
                    React.createElement(
                      'div',
                      {
                        key: `pending-${i}`,
                        className:
                          'w-16 h-16 rounded-md overflow-hidden border border-dashed border-white/20',
                      },
                      React.createElement('img', {
                        src: r.url,
                        alt: 'pending',
                        className: 'w-full h-full object-cover',
                      })
                    )
                  )
                ),
                React.createElement('input', {
                  ref: fileInputRef,
                  type: 'file',
                  accept: 'image/*',
                  multiple: true,
                  className: 'hidden',
                  onChange: handleUploadRefs,
                }),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    disabled: busy || !selectedId,
                    onClick: () => fileInputRef.current?.click(),
                    className:
                      'text-[11px] text-white/50 hover:text-white/80 disabled:opacity-40',
                  },
                  '+ Upload product references'
                )
              ),
              React.createElement(
                'div',
                { className: 'space-y-2' },
                React.createElement(
                  'span',
                  {
                    className:
                      'text-[10px] font-bold uppercase tracking-widest text-white/35',
                  },
                  'Scene preset'
                ),
                React.createElement(
                  'div',
                  { className: 'flex flex-wrap gap-2' },
                  PRODUCT_SCENE_PRESETS.map((p) =>
                    React.createElement(
                      'button',
                      {
                        key: p.id,
                        type: 'button',
                        onClick: () => handlePresetSelect(p),
                        title: p.description,
                        className: `px-2.5 py-1.5 rounded-md text-[10px] font-semibold border ${
                          scenePreset === p.name
                            ? 'border-[#22d3ee]/50 bg-[#22d3ee]/10 text-[#22d3ee]'
                            : 'border-white/10 text-white/55 hover:border-white/25'
                        }`,
                      },
                      p.name
                    )
                  )
                )
              ),
              React.createElement(
                'label',
                { className: 'block space-y-1' },
                React.createElement(
                  'span',
                  {
                    className:
                      'text-[10px] font-bold uppercase tracking-widest text-white/35',
                  },
                  'Prompt'
                ),
                React.createElement('textarea', {
                  value: customPrompt,
                  rows: 5,
                  onChange: (e) => {
                    setCustomPrompt(e.target.value);
                    setScenePreset('');
                  },
                  className:
                    'w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90',
                })
              ),
              React.createElement(
                'label',
                { className: 'block space-y-1' },
                React.createElement(
                  'span',
                  {
                    className:
                      'text-[10px] font-bold uppercase tracking-widest text-white/35',
                  },
                  'Aspect ratio'
                ),
                React.createElement(
                  'select',
                  {
                    value: aspectRatio,
                    onChange: (e) => setAspectRatio(e.target.value),
                    className:
                      'w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-sm text-white/90',
                  },
                  PRODUCT_ASPECT_RATIOS.map((r) =>
                    React.createElement('option', { key: r, value: r }, r)
                  )
                )
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  disabled: busy || !selectedId,
                  onClick: handleGenerate,
                  className:
                    'h-11 w-full rounded-md bg-[#22d3ee] text-black text-xs font-black uppercase tracking-widest disabled:opacity-40',
                },
                busy ? 'Generating…' : 'Generate product scene'
              )
            ),
            React.createElement(
              'div',
              { className: 'space-y-4' },
              React.createElement(
                'h2',
                {
                  className:
                    'text-[10px] font-bold uppercase tracking-widest text-white/35',
                },
                'Results'
              ),
              !results
                ? React.createElement(
                    'p',
                    { className: 'text-sm text-white/35' },
                    'Generated scenes appear here as Dynaxis Assets. Promote explicitly to add a scene to Product references.'
                  )
                : React.createElement(
                    'div',
                    { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
                    results.urls.map((url, i) => {
                      const asset = results.assets?.[i];
                      return React.createElement(
                        'div',
                        {
                          key: url,
                          className:
                            'rounded-xl border border-white/10 overflow-hidden bg-black/30',
                        },
                        React.createElement('img', {
                          src: url,
                          alt: `Result ${i + 1}`,
                          className: 'w-full aspect-square object-cover',
                        }),
                        React.createElement(
                          'div',
                          { className: 'p-2 flex gap-2' },
                          React.createElement(
                            'button',
                            {
                              type: 'button',
                              className:
                                'flex-1 h-8 text-[10px] font-bold uppercase tracking-wider text-white/60 border border-white/10 rounded-md hover:bg-white/5',
                              onClick: () =>
                                downloadImage(url, `product-scene-${i + 1}.jpg`),
                            },
                            'Download'
                          ),
                          asset?.id
                            ? React.createElement(
                                'button',
                                {
                                  type: 'button',
                                  disabled: busy,
                                  className:
                                    'flex-1 h-8 text-[10px] font-bold uppercase tracking-wider text-[#22d3ee] border border-[#22d3ee]/30 rounded-md hover:bg-[#22d3ee]/10',
                                  onClick: () => handlePromote(asset.id),
                                },
                                'Promote ref'
                              )
                            : null
                        )
                      );
                    })
                  )
            )
          )
        : null
    )
  );
}
