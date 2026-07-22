'use client';

/**
 * Dynaxis Design Agent Studio — PATH B
 * CreativeCanvas/Konva is no longer document authority.
 * Composition Document is canonical; this UI is a controller + Composition preview.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPlatformClient } from '../../../../lib/dynaxis/client/platform-api.js';
import { readProjectContext } from '../../../../lib/dynaxis/client/project-context.js';
import { sortLayersForRender } from '../../../../lib/dynaxis/compositions/index.js';

function readQueryParam(key) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

function LayerPreview({ layer, assetUrl }) {
  if (layer.type === 'image') {
    if (!assetUrl) {
      return <div className="w-full h-full bg-white/5" />;
    }
    return (
      <img
        src={assetUrl}
        alt={layer.name || 'layer'}
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
    );
  }
  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{
        color: layer.color,
        backgroundColor: layer.backgroundColor || 'transparent',
        fontFamily: layer.fontFamily,
        fontSize: Math.max(8, (layer.fontSize || 16) * 0.5),
        fontWeight: layer.fontWeight,
        lineHeight: layer.lineHeight,
        textAlign: layer.textAlign,
        padding: layer.padding,
        opacity: layer.opacity,
      }}
    >
      {layer.text}
    </div>
  );
}

/**
 * @param {{ apiKey: string, isHeaderVisible?: boolean, onToggleHeader?: Function }} props
 */
export default function DesignAgentStudio({ apiKey, isHeaderVisible, onToggleHeader }) {
  const client = useMemo(
    () => (apiKey ? createPlatformClient(apiKey) : null),
    [apiKey]
  );

  const [composition, setComposition] = useState(null);
  const [document, setDocument] = useState(null);
  const [assetUrls, setAssetUrls] = useState({});
  const [compositions, setCompositions] = useState([]);
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState(null);
  const [chatLog, setChatLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  // sessionStorage flag retained only for shell tab navigation (StandaloneShell)
  useEffect(() => {
    try {
      sessionStorage.setItem('fromDesignAgent', 'true');
    } catch {
      /* ignore */
    }
    // Intentionally do NOT write localStorage.token — Dynaxis session helper owns credentials.
    // Intentionally do NOT call MuAPI balance for authorization.
  }, []);

  const loadAssetUrls = useCallback(
    async (doc) => {
      if (!doc || !client) return;
      const ids = new Set();
      if (doc.background?.assetId) ids.add(doc.background.assetId);
      for (const l of doc.layers || []) {
        if (l.type === 'image' && l.assetId) ids.add(l.assetId);
      }
      const map = { ...assetUrls };
      for (const id of ids) {
        if (map[id]) continue;
        try {
          const res = await client.getAsset(id);
          const url = res?.asset?.url || res?.url;
          if (url) map[id] = url;
        } catch {
          /* ignore */
        }
      }
      setAssetUrls(map);
    },
    [client, assetUrls]
  );

  const openComposition = useCallback(
    async (id) => {
      if (!client || !id) return;
      setBusy(true);
      setError('');
      try {
        const res = await client.getComposition(id);
        const comp = res.composition;
        setComposition(comp);
        setDocument(comp.document);
        setPlan(null);
        await loadAssetUrls(comp.document);
        setStatus(`Opened ${comp.name}`);
      } catch (e) {
        setError(e?.message || 'Failed to open Composition');
      } finally {
        setBusy(false);
      }
    },
    [client, loadAssetUrls]
  );

  const refreshList = useCallback(async () => {
    if (!client) return;
    try {
      const ctx = readProjectContext();
      const res = await client.listCompositions({
        projectId: ctx.projectId || undefined,
        limit: 40,
      });
      setCompositions(res?.compositions || []);
    } catch {
      setCompositions([]);
    }
  }, [client]);

  useEffect(() => {
    refreshList();
    const q = readQueryParam('compositionId');
    if (q) openComposition(q);
  }, [refreshList, openComposition]);

  const designAgent = useCallback(
    async (body) => {
      if (!client?.designAgentAction) {
        throw new Error('Design Agent API unavailable');
      }
      return client.designAgentAction(body);
    },
    [client]
  );

  const handlePlan = async () => {
    if (!composition || !message.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await designAgent({
        action: 'plan',
        compositionId: composition.id,
        documentVersion: composition.documentVersion,
        message: message.trim(),
      });
      setPlan(res.plan);
      setChatLog((log) => [
        ...log,
        { role: 'user', text: message.trim() },
        { role: 'assistant', text: res.plan?.summary || 'Plan ready' },
      ]);
      setMessage('');
      setStatus('Plan ready — review operations then Apply');
    } catch (e) {
      setError(e?.message || 'Planning failed');
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (!composition || !plan?.operations?.length) return;
    setBusy(true);
    setError('');
    try {
      const ctx = await designAgent({
        action: 'readContext',
        compositionId: composition.id,
      });
      const res = await designAgent({
        action: 'apply',
        compositionId: composition.id,
        documentVersion: composition.documentVersion,
        operations: plan.operations,
        summary: plan.summary,
        allowedAssetIds: ctx.approvedAssetIds || [],
      });
      setComposition(res.composition);
      setDocument(res.composition.document);
      await loadAssetUrls(res.composition.document);
      setPlan(null);
      setStatus('Applied Design Agent operations');
      setChatLog((log) => [
        ...log,
        { role: 'assistant', text: 'Applied operations to Composition draft.' },
      ]);
    } catch (e) {
      setError(e?.message || 'Apply failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveRevision = async () => {
    if (!composition) return;
    setBusy(true);
    try {
      await designAgent({
        action: 'saveRevision',
        compositionId: composition.id,
        documentVersion: composition.documentVersion,
        label: 'design-agent',
      });
      setStatus('Revision saved');
    } catch (e) {
      setError(e?.message || 'Save revision failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAdapt = async () => {
    if (!composition) return;
    const aspect = window.prompt(
      'Adapt to aspect (1:1, 9:16, 16:9). Creates a NEW Composition — starting layout.',
      '9:16'
    );
    if (!aspect) return;
    setBusy(true);
    try {
      const res = await designAgent({
        action: 'adaptComposition',
        compositionId: composition.id,
        targetAspectRatio: aspect.trim(),
      });
      const warnings = (res.warnings || []).map((w) => w.code).join(', ');
      if (warnings) setStatus(`Adapted (starting layout). Warnings: ${warnings}`);
      else setStatus('Adapted (starting layout)');
      if (res.composition?.id) {
        await openComposition(res.composition.id);
        refreshList();
      }
    } catch (e) {
      setError(e?.message || 'Adaptation failed');
    } finally {
      setBusy(false);
    }
  };

  const openInCreativeEditor = () => {
    if (!composition) return;
    window.location.href = `/studio/apps/dynaxis.creative-editor?compositionId=${composition.id}`;
  };

  const cw = document?.canvas?.width || 1080;
  const ch = document?.canvas?.height || 1080;
  const zoom = Math.min(0.45, 420 / cw);
  const bgUrl =
    document?.background?.kind === 'asset'
      ? assetUrls[document.background.assetId]
      : null;

  return (
    <div className="h-full flex flex-col bg-[#050505] text-white design-agent-studio">
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div>
          <h1 className="text-[13px] font-bold tracking-wide">Design Agent</h1>
          <p className="text-[10px] text-white/40">
            Reasons over Dynaxis Compositions · Creative Editor for precise edits · no Konva
            document authority
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {typeof onToggleHeader === 'function' ? (
            <button
              type="button"
              className="h-8 px-2 rounded border border-white/15 text-[10px]"
              onClick={() => onToggleHeader(!isHeaderVisible)}
            >
              Header
            </button>
          ) : null}
          <button
            type="button"
            disabled={!composition || busy}
            onClick={handleSaveRevision}
            className="h-8 px-3 rounded border border-white/20 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Save revision
          </button>
          <button
            type="button"
            disabled={!composition || busy}
            onClick={handleAdapt}
            className="h-8 px-3 rounded border border-white/20 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
          >
            Adapt aspect
          </button>
          <button
            type="button"
            disabled={!composition}
            onClick={openInCreativeEditor}
            className="h-8 px-3 rounded bg-[#22d3ee] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
          >
            Open in Creative Editor
          </button>
        </div>
      </header>

      {error ? <p className="text-[11px] text-amber-300/90 px-4 py-1">{error}</p> : null}
      {status ? <p className="text-[11px] text-[#22d3ee]/80 px-4 py-1">{status}</p> : null}

      <div className="flex flex-1 min-h-0">
        <aside className="w-52 border-r border-white/10 p-2 overflow-auto text-[11px]">
          <p className="text-white/40 uppercase tracking-widest text-[9px] mb-2">Compositions</p>
          {compositions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openComposition(c.id)}
              className={`w-full text-left px-2 py-1.5 rounded mb-1 ${
                composition?.id === c.id ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className="block truncate">{c.name}</span>
              <span className="text-[9px] text-white/30">v{c.documentVersion}</span>
            </button>
          ))}
          {!compositions.length ? (
            <p className="text-white/30 text-[10px]">
              No Compositions in this Project. Create one in Creative Editor or Design Library.
            </p>
          ) : null}
        </aside>

        <main className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#0a0a0a]">
          {document ? (
            <div
              className="relative border border-white/10 shadow-2xl"
              style={{
                width: cw * zoom,
                height: ch * zoom,
                background:
                  document.background?.kind === 'color'
                    ? document.background.color || '#111'
                    : document.canvas.backgroundColor || '#111',
              }}
            >
              <div
                className="absolute origin-top-left"
                style={{ width: cw, height: ch, transform: `scale(${zoom})` }}
              >
                {bgUrl ? (
                  <img
                    src={bgUrl}
                    alt="background"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                ) : null}
                {sortLayersForRender(document.layers || [])
                  .filter((l) => l.visible !== false)
                  .map((layer) => (
                    <div
                      key={layer.id}
                      className="absolute overflow-hidden"
                      style={{
                        left: layer.x,
                        top: layer.y,
                        width: layer.width,
                        height: layer.height,
                        zIndex: layer.zIndex,
                        opacity: layer.opacity,
                        transform: layer.rotation
                          ? `rotate(${layer.rotation}deg)`
                          : undefined,
                      }}
                    >
                      <LayerPreview
                        layer={layer}
                        assetUrl={
                          layer.type === 'image' ? assetUrls[layer.assetId] : null
                        }
                      />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="text-white/40 text-sm">Select a Composition to begin</p>
          )}
        </main>

        <aside className="w-80 border-l border-white/10 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto p-3 space-y-2 text-[11px]">
            {chatLog.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={m.role === 'user' ? 'text-white/90' : 'text-[#22d3ee]/90'}
              >
                <span className="text-[9px] uppercase text-white/30">{m.role}</span>
                <p>{m.text}</p>
              </div>
            ))}
            {plan?.operations?.length ? (
              <div className="border border-white/10 rounded p-2 space-y-1">
                <p className="text-[9px] uppercase text-white/40">Pending plan</p>
                <p className="text-white/70">{plan.summary}</p>
                <ul className="text-[10px] text-white/50 list-disc pl-4">
                  {plan.operations.map((op, i) => (
                    <li key={`${op.type}-${i}`}>{op.type}</li>
                  ))}
                </ul>
                {(plan.warnings || []).length ? (
                  <p className="text-amber-300/80 text-[10px]">
                    {plan.warnings.join(' · ')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="p-3 border-t border-white/10 space-y-2">
            <textarea
              className="w-full min-h-[72px] bg-black/40 border border-white/10 rounded p-2 text-[11px]"
              placeholder="e.g. Move the headline to the top left and use the Brand accent colour"
              value={message}
              disabled={!composition || busy}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!composition || busy || !message.trim()}
                onClick={handlePlan}
                className="flex-1 h-8 rounded border border-[#22d3ee]/40 text-[#22d3ee] text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
              >
                Plan
              </button>
              <button
                type="button"
                disabled={!plan?.operations?.length || busy}
                onClick={handleApply}
                className="flex-1 h-8 rounded bg-[#22d3ee] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
              >
                Apply
              </button>
            </div>
            <p className="text-[9px] text-white/30">
              Provider credentials stay server-side. MuAPI balance is not used for authorization.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
