'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { DESIGN_TEMPLATE_CATEGORIES, DESIGN_COMPONENT_CATEGORIES } from '../../../lib/dynaxis/types.js';

/**
 * Design Library — Templates / Components / Design Systems (minimal Phase 6I).
 * Editing routes into Creative Editor Template or Component mode.
 */
export default function DesignLibraryMiniApp({ runtime }) {
  const [tab, setTab] = useState('templates'); // templates | components | systems
  const [templates, setTemplates] = useState([]);
  const [components, setComponents] = useState([]);
  const [componentSets, setComponentSets] = useState([]);
  const [designSystems, setDesignSystems] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const categories = tab === 'templates' ? DESIGN_TEMPLATE_CATEGORIES : DESIGN_COMPONENT_CATEGORIES;

  const refresh = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      if (tab === 'templates') {
        const res = await runtime.listDesignTemplates({
          category: category || undefined,
          limit: 100,
        });
        setTemplates(res?.templates || []);
      } else if (tab === 'components') {
        const [compRes, setRes] = await Promise.all([
          runtime.listDesignComponents({
            category: category || undefined,
            limit: 100,
          }),
          runtime.listDesignComponentSets
            ? runtime.listDesignComponentSets({ limit: 100 })
            : Promise.resolve({ componentSets: [] }),
        ]);
        setComponents(compRes?.components || []);
        setComponentSets(setRes?.componentSets || []);
      } else {
        const res = await runtime.listDesignSystems({ limit: 100 });
        setDesignSystems(res?.designSystems || []);
      }
    } catch (e) {
      setError(e?.message || `Failed to load ${tab}`);
    } finally {
      setBusy(false);
    }
  }, [runtime, category, tab]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredTemplates = templates.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(t.name || '')
        .toLowerCase()
        .includes(q) ||
      String(t.description || '')
        .toLowerCase()
        .includes(q)
    );
  });

  const filteredComponents = components.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(c.name || '')
        .toLowerCase()
        .includes(q) ||
      String(c.description || '')
        .toLowerCase()
        .includes(q)
    );
  });

  const filteredSystems = designSystems.filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(s.name || '')
        .toLowerCase()
        .includes(q) ||
      String(s.description || '')
        .toLowerCase()
        .includes(q)
    );
  });

  const filteredSets = componentSets.filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return String(s.name || '')
      .toLowerCase()
      .includes(q);
  });

  const handleInstantiate = async (template) => {
    setBusy(true);
    setError('');
    try {
      const ctx = runtime.getProjectContext?.() || {};
      const name = window.prompt('Composition name', `${template.name} — instance`);
      if (!name) return;
      const res = await runtime.instantiateDesignTemplate({
        templateId: template.id,
        templateRevisionId: template.currentRevisionId,
        projectId: ctx.projectId || undefined,
        name,
        binding: {
          projectId: ctx.projectId,
        },
      });
      const compositionId = res?.composition?.id;
      if (compositionId) {
        window.location.href = `/studio/apps/dynaxis.creative-editor?compositionId=${compositionId}`;
      } else {
        setStatusMessage('Instantiated');
        refresh();
      }
    } catch (e) {
      setError(e?.message || 'Instantiate failed');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (template) => {
    if (!window.confirm(`Archive “${template.name}”?`)) return;
    setBusy(true);
    try {
      await runtime.archiveDesignTemplate(template.id);
      setStatusMessage('Archived');
      refresh();
    } catch (e) {
      setError(e?.message || 'Archive failed');
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (template) => {
    if (!template.currentRevisionId) {
      setError('Template has no revision');
      return;
    }
    const q = new URLSearchParams({
      templateId: template.id,
      templateRevisionId: template.currentRevisionId,
      mode: 'template',
    });
    window.location.href = `/studio/apps/dynaxis.creative-editor?${q}`;
  };

  const handleEditComponent = (component) => {
    if (!component.currentRevisionId) {
      setError('Component has no revision');
      return;
    }
    const q = new URLSearchParams({
      componentId: component.id,
      componentRevisionId: component.currentRevisionId,
      mode: 'component',
    });
    window.location.href = `/studio/apps/dynaxis.creative-editor?${q}`;
  };

  const handleArchiveComponent = async (component) => {
    if (!window.confirm(`Archive “${component.name}”?`)) return;
    setBusy(true);
    try {
      await runtime.archiveDesignComponent(component.id);
      setStatusMessage('Archived');
      refresh();
    } catch (e) {
      setError(e?.message || 'Archive failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateComponent = () => {
    window.location.href = `/studio/apps/dynaxis.creative-editor?mode=component`;
  };

  const handleCreateDesignSystem = async () => {
    const name = window.prompt('Design System name', 'Untitled Design System');
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      await runtime.createDesignSystem({ name, status: 'draft' });
      setStatusMessage('Design System created');
      refresh();
    } catch (e) {
      setError(e?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateFromBrand = async () => {
    const brandId = window.prompt('Brand ID (UUID)');
    if (!brandId) return;
    setBusy(true);
    setError('');
    try {
      await runtime.createDesignSystemFromBrand({ brandId });
      setStatusMessage('Design System seeded from Brand');
      refresh();
    } catch (e) {
      setError(e?.message || 'Create from Brand failed');
    } finally {
      setBusy(false);
    }
  };

  const handleArchiveDesignSystem = async (system) => {
    if (!window.confirm(`Archive “${system.name}”?`)) return;
    setBusy(true);
    try {
      await runtime.archiveDesignSystem(system.id);
      setStatusMessage('Archived');
      refresh();
    } catch (e) {
      setError(e?.message || 'Archive failed');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDesignSystem = (system) => {
    if (!system.currentRevisionId) {
      setError('Design System has no revision');
      return;
    }
    // Minimal: open Creative Editor with composition blank + designSystem query hint
    const q = new URLSearchParams({
      designSystemId: system.id,
      designSystemRevisionId: system.currentRevisionId,
    });
    window.location.href = `/studio/apps/dynaxis.creative-editor?${q}`;
  };

  const handleArchiveComponentSet = async (set) => {
    if (!window.confirm(`Archive “${set.name}”?`)) return;
    setBusy(true);
    try {
      await runtime.archiveDesignComponentSet(set.id);
      setStatusMessage('Archived');
      refresh();
    } catch (e) {
      setError(e?.message || 'Archive failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#050505] text-white">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[13px] font-bold tracking-wide">Design Library</h1>
          <p className="text-[10px] text-white/40">
            Templates, Components, Design Systems · not a marketplace
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex rounded border border-white/15 overflow-hidden text-[10px] font-bold uppercase tracking-widest">
            <button
              type="button"
              className={`h-8 px-3 ${tab === 'templates' ? 'bg-white/10 text-white' : 'text-white/50'}`}
              onClick={() => {
                setTab('templates');
                setCategory('');
                setSelectedId(null);
              }}
            >
              Templates
            </button>
            <button
              type="button"
              className={`h-8 px-3 border-l border-white/15 ${
                tab === 'components' ? 'bg-white/10 text-white' : 'text-white/50'
              }`}
              onClick={() => {
                setTab('components');
                setCategory('');
                setSelectedId(null);
              }}
            >
              Components
            </button>
            <button
              type="button"
              className={`h-8 px-3 border-l border-white/15 ${
                tab === 'systems' ? 'bg-white/10 text-white' : 'text-white/50'
              }`}
              onClick={() => {
                setTab('systems');
                setCategory('');
                setSelectedId(null);
              }}
            >
              Design Systems
            </button>
          </div>
          <input
            type="search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-28 bg-black/40 border border-white/15 rounded px-2 text-[11px]"
            aria-label="Search"
          />
          {tab !== 'systems' ? (
            <select
              className="h-8 bg-black/40 border border-white/15 rounded px-2 text-[11px]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={refresh}
            className="h-8 px-3 rounded border border-white/20 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <p className="text-[11px] text-amber-300/90 px-4 py-2">{error}</p>
      ) : null}
      {statusMessage ? (
        <p className="text-[11px] text-[#22d3ee]/80 px-4 py-1">{statusMessage}</p>
      ) : null}

      <div className="flex-1 overflow-auto p-4">
        {tab === 'templates' ? (
          !filteredTemplates.length && !busy ? (
            <p className="text-white/40 text-sm">
              No templates yet. Open a Composition in Creative Editor and use Save as Template.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTemplates.map((t) => (
                <div
                  key={t.id}
                  className={`border border-white/10 rounded p-3 ${
                    selectedId === t.id ? 'border-[#22d3ee]/50' : ''
                  }`}
                  onClick={() => setSelectedId(t.id)}
                  onKeyDown={() => {}}
                  role="button"
                  tabIndex={0}
                >
                  <div className="aspect-video bg-black/50 border border-white/5 mb-2 flex items-center justify-center text-white/20 text-[10px]">
                    {t.thumbnailAssetId ? `thumb ${t.thumbnailAssetId.slice(0, 8)}` : 'No thumbnail'}
                  </div>
                  <h2 className="text-[12px] font-semibold truncate">{t.name}</h2>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    {t.category} · {t.status}
                    {t.brandBinding === 'bound' ? ' · brand-bound' : ''}
                  </p>
                  {t.description ? (
                    <p className="text-[10px] text-white/50 mt-1 line-clamp-2">{t.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1 mt-3">
                    <button
                      type="button"
                      disabled={busy}
                      className="h-7 px-2 rounded bg-[#22d3ee] text-black text-[9px] font-black uppercase tracking-widest disabled:opacity-40"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstantiate(t);
                      }}
                    >
                      Create from Template
                    </button>
                    <button
                      type="button"
                      className="h-7 px-2 rounded border border-white/20 text-[9px] font-bold uppercase tracking-widest"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(t);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="h-7 px-2 rounded border border-white/10 text-white/50 text-[9px] font-bold uppercase tracking-widest"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(t);
                      }}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === 'components' ? (
          <div className="space-y-6">
            {!filteredComponents.length && !busy ? (
              <div className="space-y-3">
                <p className="text-white/40 text-sm">
                  No components yet. Create one from selected layers in Creative Editor, or open
                  Component mode.
                </p>
                <button
                  type="button"
                  className="h-8 px-3 rounded border border-[#22d3ee]/40 text-[#22d3ee] text-[10px] font-bold uppercase tracking-widest"
                  onClick={handleCreateComponent}
                >
                  Create Component
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredComponents.map((c) => (
                  <div
                    key={c.id}
                    className={`border border-white/10 rounded p-3 ${
                      selectedId === c.id ? 'border-[#22d3ee]/50' : ''
                    }`}
                    onClick={() => setSelectedId(c.id)}
                    onKeyDown={() => {}}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="aspect-video bg-black/50 border border-white/5 mb-2 flex items-center justify-center text-white/20 text-[10px]">
                      {c.thumbnailAssetId
                        ? `thumb ${c.thumbnailAssetId.slice(0, 8)}`
                        : 'No thumbnail'}
                    </div>
                    <h2 className="text-[12px] font-semibold truncate">{c.name}</h2>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      {c.category} · {c.status}
                    </p>
                    {c.description ? (
                      <p className="text-[10px] text-white/50 mt-1 line-clamp-2">{c.description}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1 mt-3">
                      <button
                        type="button"
                        className="h-7 px-2 rounded bg-[#22d3ee] text-black text-[9px] font-black uppercase tracking-widest"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditComponent(c);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="h-7 px-2 rounded border border-white/10 text-white/50 text-[9px] font-bold uppercase tracking-widest"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveComponent(c);
                        }}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-white/10 pt-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
                Component Sets
              </h3>
              {!filteredSets.length ? (
                <p className="text-white/30 text-[11px]">No Component Sets yet.</p>
              ) : (
                <ul className="space-y-2">
                  {filteredSets.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 border border-white/10 rounded px-3 py-2"
                    >
                      <div>
                        <p className="text-[12px] font-semibold">{s.name}</p>
                        <p className="text-[10px] text-white/40">
                          {s.category} · {s.status} · {(s.variantAxes || []).length} axes
                        </p>
                      </div>
                      <button
                        type="button"
                        className="h-7 px-2 rounded border border-white/10 text-white/50 text-[9px] font-bold uppercase tracking-widest"
                        onClick={() => handleArchiveComponentSet(s)}
                      >
                        Archive
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="h-8 px-3 rounded bg-[#22d3ee] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                onClick={handleCreateDesignSystem}
              >
                Create Design System
              </button>
              <button
                type="button"
                disabled={busy}
                className="h-8 px-3 rounded border border-white/20 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
                onClick={handleCreateFromBrand}
              >
                Create from Brand
              </button>
            </div>
            {!filteredSystems.length && !busy ? (
              <p className="text-white/40 text-sm">No Design Systems yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSystems.map((s) => (
                  <div
                    key={s.id}
                    className={`border border-white/10 rounded p-3 ${
                      selectedId === s.id ? 'border-[#22d3ee]/50' : ''
                    }`}
                    onClick={() => setSelectedId(s.id)}
                    onKeyDown={() => {}}
                    role="button"
                    tabIndex={0}
                  >
                    <h2 className="text-[12px] font-semibold truncate">{s.name}</h2>
                    <p className="text-[10px] text-white/40 mt-0.5">{s.status}</p>
                    {s.description ? (
                      <p className="text-[10px] text-white/50 mt-1 line-clamp-2">{s.description}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1 mt-3">
                      <button
                        type="button"
                        className="h-7 px-2 rounded bg-[#22d3ee] text-black text-[9px] font-black uppercase tracking-widest"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDesignSystem(s);
                        }}
                      >
                        Open editor
                      </button>
                      <button
                        type="button"
                        className="h-7 px-2 rounded border border-white/10 text-white/50 text-[9px] font-bold uppercase tracking-widest"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveDesignSystem(s);
                        }}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
