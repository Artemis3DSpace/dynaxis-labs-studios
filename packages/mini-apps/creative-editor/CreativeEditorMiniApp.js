'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import {
  sortLayersForRender,
  nudgeLayer,
  compositionBrandHints,
  createUndoState,
  pushUndo,
  undo,
  redo,
  canUndo,
  canRedo,
  POSITION_PRESETS,
  positionFromPreset,
} from '../../../lib/dynaxis/compositions/index.js';
import {
  DESIGN_TEMPLATE_TEXT_ROLES,
  DESIGN_TEMPLATE_IMAGE_ROLES,
  DESIGN_COMPONENT_DOCUMENT_VERSION,
} from '../../../lib/dynaxis/types.js';
import {
  componentDocumentToCompositionDocument,
  parseComponentDocument,
  resolveComponentInstance,
} from '../../../lib/dynaxis/components/index.js';

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readQueryParam(key) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(key);
}

function LayerPreview({ layer, assetUrl }) {
  if (layer.type === 'component_instance') {
    return (
      <div className="w-full h-full border border-dashed border-white/30 bg-white/5 flex items-center justify-center text-[9px] text-white/40 pointer-events-none">
        Component
      </div>
    );
  }
  if (layer.type === 'image') {
    if (!assetUrl) return null;
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
        fontSize: layer.fontSize,
        fontWeight: layer.fontWeight,
        lineHeight: layer.lineHeight,
        letterSpacing: layer.letterSpacing,
        textAlign: layer.textAlign,
        padding: layer.padding,
        borderRadius: layer.borderRadius,
        opacity: layer.opacity,
      }}
    >
      {layer.text}
    </div>
  );
}

export default function CreativeEditorMiniApp({ runtime }) {
  const [composition, setComposition] = useState(null);
  const [document, setDocument] = useState(null);
  const [documentVersion, setDocumentVersion] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [assetUrls, setAssetUrls] = useState({});
  const [brandPalette, setBrandPalette] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(0.5);
  const [regenState, setRegenState] = useState('idle'); // idle | preparing | queued | generating | completed | failed
  const regenActive = useRef(false);
  const undoRef = useRef(createUndoState());
  const saveTimer = useRef(null);
  const [templateMode, setTemplateMode] = useState(false);
  const [componentMode, setComponentMode] = useState(false);
  const [templateMeta, setTemplateMeta] = useState(null);
  const [componentMeta, setComponentMeta] = useState(null);
  const [templateSlots, setTemplateSlots] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [componentName, setComponentName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('custom');
  const [adaptWarnings, setAdaptWarnings] = useState([]);
  const [componentRevisionDocs, setComponentRevisionDocs] = useState({});
  const [componentHeads, setComponentHeads] = useState({});
  const [designTokenDoc, setDesignTokenDoc] = useState(null);
  const [designSystemMeta, setDesignSystemMeta] = useState(null);
  const [availableTokens, setAvailableTokens] = useState([]);
  const [tokenCollections, setTokenCollections] = useState([]);
  const [variantAxes, setVariantAxes] = useState([]);
  const [variantMaps, setVariantMaps] = useState([]);

  const selectedLayer = useMemo(
    () => document?.layers?.find((l) => l.id === selectedId) || null,
    [document, selectedId]
  );

  const previewLayers = useMemo(() => {
    if (!document?.layers) return [];
    const out = [];
    for (const layer of document.layers) {
      if (layer.type !== 'component_instance') {
        out.push(layer);
        continue;
      }
      const revDoc = componentRevisionDocs[layer.componentRevisionId];
      if (!revDoc) {
        out.push(layer);
        continue;
      }
      try {
        const resolved = resolveComponentInstance(
          revDoc,
          layer.overrides || [],
          {
            x: layer.x,
            y: layer.y,
            width: layer.width,
            height: layer.height,
            rotation: layer.rotation,
            opacity: layer.opacity,
            visible: layer.visible,
            fitMode: layer.fitMode || 'proportional',
          },
          { instanceLayerId: layer.id }
        );
        for (const child of resolved.layers) {
          out.push({
            ...child,
            zIndex: (layer.zIndex ?? 0) * 1000 + (child.zIndex ?? 0),
            locked: true,
            __fromInstance: layer.id,
          });
        }
      } catch {
        out.push(layer);
      }
    }
    return out;
  }, [document, componentRevisionDocs]);

  const instanceUpdateAvailable =
    selectedLayer?.type === 'component_instance' &&
    componentHeads[selectedLayer.componentId] &&
    componentHeads[selectedLayer.componentId] !== selectedLayer.componentRevisionId;

  const designSystemPinned = Boolean(
    composition?.designSystemRevisionId ||
      document?.designSystem?.designSystemRevisionId ||
      designSystemMeta?.revisionId
  );

  const loadDesignSystemTokens = useCallback(
    async (comp, doc) => {
      if (!runtime?.getDesignSystemRevision) return;
      const systemId =
        comp?.designSystemId || doc?.designSystem?.designSystemId || readQueryParam('designSystemId');
      const revisionId =
        comp?.designSystemRevisionId ||
        doc?.designSystem?.designSystemRevisionId ||
        readQueryParam('designSystemRevisionId');
      if (!systemId || !revisionId) {
        setDesignTokenDoc(null);
        setDesignSystemMeta(null);
        setAvailableTokens([]);
        setTokenCollections([]);
        return;
      }
      try {
        const res = await runtime.getDesignSystemRevision(systemId, revisionId);
        const tokenDoc = res?.revision?.document || null;
        setDesignTokenDoc(tokenDoc);
        setDesignSystemMeta({
          designSystemId: systemId,
          revisionId,
        });
        const tokens = (tokenDoc?.tokens || []).map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
        }));
        setAvailableTokens(tokens);
        setTokenCollections(tokenDoc?.collections || []);
      } catch {
        setDesignTokenDoc(null);
        setAvailableTokens([]);
        setTokenCollections([]);
      }
    },
    [runtime]
  );

  const loadAssetUrls = useCallback(
    async (doc) => {
      if (!doc || !runtime?.getAsset) return;
      const ids = new Set();
      if (doc.background?.assetId) ids.add(doc.background.assetId);
      for (const l of doc.layers || []) {
        if (l.type === 'image' && l.assetId) ids.add(l.assetId);
      }
      const map = { ...assetUrls };
      for (const id of ids) {
        if (map[id]) continue;
        try {
          const res = await runtime.getAsset(id);
          const url = res?.asset?.url || res?.url;
          if (!url) continue;
          if (String(url).startsWith('dynaxis-blob://') && runtime.getAssetContentBlob) {
            const blob = await runtime.getAssetContentBlob(id);
            map[id] = URL.createObjectURL(blob);
          } else {
            map[id] = url;
          }
        } catch {
          /* ignore */
        }
      }
      setAssetUrls(map);
    },
    [runtime, assetUrls]
  );

  const cacheComponentRevisionDocs = useCallback(
    async (doc) => {
      if (!doc?.layers || !runtime?.getDesignComponentRevision) return;
      const next = { ...componentRevisionDocs };
      const heads = { ...componentHeads };
      for (const layer of doc.layers) {
        if (layer.type !== 'component_instance') continue;
        if (!next[layer.componentRevisionId]) {
          try {
            const res = await runtime.getDesignComponentRevision(
              layer.componentId,
              layer.componentRevisionId
            );
            if (res?.revision?.document) next[layer.componentRevisionId] = res.revision.document;
          } catch {
            /* ignore */
          }
        }
        if (!heads[layer.componentId]) {
          try {
            const res = await runtime.getDesignComponent(layer.componentId);
            if (res?.component?.currentRevisionId) {
              heads[layer.componentId] = res.component.currentRevisionId;
            }
          } catch {
            /* ignore */
          }
        }
      }
      setComponentRevisionDocs(next);
      setComponentHeads(heads);
    },
    [runtime, componentRevisionDocs, componentHeads]
  );

  const bootstrap = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const deliverableId = readQueryParam('deliverableId');
      const compositionId = readQueryParam('compositionId');
      const assetId = readQueryParam('assetId');
      const templateId = readQueryParam('templateId');
      const templateRevisionId = readQueryParam('templateRevisionId');
      const componentId = readQueryParam('componentId');
      const componentRevisionId = readQueryParam('componentRevisionId');
      const mode = readQueryParam('mode');
      const selectedTemplateId = readQueryParam('selectedTemplateId');
      const designSystemId = readQueryParam('designSystemId');
      const designSystemRevisionId = readQueryParam('designSystemRevisionId');

      if (mode === 'component') {
        setComponentMode(true);
        if (componentId) {
          const res = await runtime.getDesignComponent(componentId);
          const revId = componentRevisionId || res.component?.currentRevisionId;
          const rev = revId
            ? await runtime.getDesignComponentRevision(componentId, revId)
            : null;
          const componentDoc = rev?.revision?.document;
          if (!componentDoc) {
            setError('Component revision not found');
            return;
          }
          const editorDoc = componentDocumentToCompositionDocument(componentDoc);
          setComponentMeta({ component: res.component, revision: rev.revision });
          setComponentName(res.component.name);
          setComposition({
            id: `component:${componentId}`,
            name: res.component.name,
            documentVersion: 1,
            brandId: res.component.brandId,
          });
          setDocument(editorDoc);
          setDocumentVersion(1);
          pushUndo(undoRef.current, editorDoc);
          await loadAssetUrls(editorDoc);
          return;
        }
        // Blank component authoring canvas
        const blank = componentDocumentToCompositionDocument({
          version: DESIGN_COMPONENT_DOCUMENT_VERSION,
          intrinsicWidth: 800,
          intrinsicHeight: 600,
          layers: [],
          properties: [],
        });
        setComponentMeta(null);
        setComponentName('New Component');
        setComposition({
          id: 'component:new',
          name: 'New Component',
          documentVersion: 1,
        });
        setDocument(blank);
        setDocumentVersion(1);
        pushUndo(undoRef.current, blank);
        return;
      }

      if (mode === 'template' && templateId) {
        setTemplateMode(true);
        const res = await runtime.getDesignTemplate(templateId);
        const revId = templateRevisionId || res.template?.currentRevisionId;
        const rev = revId
          ? await runtime.getDesignTemplateRevision(templateId, revId)
          : null;
        const doc = rev?.revision?.document;
        if (!doc) {
          setError('Template revision not found');
          return;
        }
        setTemplateMeta({ template: res.template, revision: rev.revision });
        setTemplateName(res.template.name);
        setTemplateCategory(res.template.category || 'custom');
        setTemplateSlots(doc.slots || []);
        setComposition({
          id: `template:${templateId}`,
          name: res.template.name,
          documentVersion: 1,
          brandId: res.template.brandId,
        });
        setDocument(doc);
        setDocumentVersion(1);
        pushUndo(undoRef.current, doc);
        await loadAssetUrls(doc);
        return;
      }

      let result;
      if (deliverableId) {
        result = await runtime.createCompositionFromDeliverable({
          deliverableId,
          ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
        });
      } else if (compositionId) {
        result = await runtime.getComposition(compositionId);
        result = { composition: result.composition };
      } else if (assetId) {
        result = await runtime.createCompositionFromAsset({ assetId });
      } else if (designSystemId && designSystemRevisionId) {
        const blank = {
          version: 1,
          canvas: {
            width: 1080,
            height: 1080,
            backgroundColor: '#111111',
            transparent: false,
          },
          background: {
            kind: 'color',
            color: '#111111',
            fit: 'cover',
            position: 'middle-center',
            opacity: 1,
            assetId: null,
          },
          layers: [],
          designSystem: {
            designSystemId,
            designSystemRevisionId,
            modes: {},
          },
        };
        setComposition({
          id: `design-system:${designSystemId}`,
          name: 'Design System draft',
          documentVersion: 1,
          designSystemId,
          designSystemRevisionId,
          designSystemModes: {},
        });
        setDocument(blank);
        setDocumentVersion(1);
        pushUndo(undoRef.current, blank);
        await loadDesignSystemTokens(
          {
            designSystemId,
            designSystemRevisionId,
          },
          blank
        );
        return;
      } else {
        setError(
          'Open with ?deliverableId=, ?compositionId=, ?assetId=, Design System, Template mode, or Component mode'
        );
        return;
      }
      const comp = result.composition;
      setComposition(comp);
      setDocument(comp.document);
      setDocumentVersion(comp.documentVersion || 1);
      pushUndo(undoRef.current, comp.document);
      await loadAssetUrls(comp.document);
      await cacheComponentRevisionDocs(comp.document);
      await loadDesignSystemTokens(comp, comp.document);
      if (comp.brandId) {
        try {
          const brand = await runtime.getBrand?.(comp.brandId);
          const rev = comp.brandRevisionId
            ? await runtime.getBrandRevision?.(comp.brandId, comp.brandRevisionId)
            : null;
          const hints = compositionBrandHints({
            primaryColors: rev?.snapshot?.dna?.primaryColors || brand?.primaryColors,
            secondaryColors: rev?.snapshot?.dna?.secondaryColors || brand?.secondaryColors,
            fonts: rev?.snapshot?.dna?.fonts || brand?.fonts,
          });
          setBrandPalette(hints.palette);
        } catch {
          /* optional */
        }
      }
    } catch (e) {
      setError(e?.message || 'Failed to load composition');
    } finally {
      setBusy(false);
    }
  }, [runtime, loadAssetUrls, cacheComponentRevisionDocs, loadDesignSystemTokens]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const scheduleSave = useCallback(
    (nextDoc, version) => {
      if (
        !composition ||
        templateMode ||
        componentMode ||
        String(composition.id || '').startsWith('design-system:')
      ) {
        if (templateMode) setSaveState('template');
        if (componentMode) setSaveState('component');
        return;
      }
      setSaveState('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await runtime.updateCompositionDraft(composition.id, {
            document: nextDoc,
            documentVersion: version,
          });
          setComposition(res.composition);
          setDocumentVersion(res.composition.documentVersion);
          setSaveState('saved');
          await cacheComponentRevisionDocs(nextDoc);
        } catch (e) {
          setSaveState('error');
          setError(e?.message || 'Autosave failed');
        }
      }, 800);
    },
    [composition, runtime, templateMode, componentMode, cacheComponentRevisionDocs]
  );

  const handleSaveAsTemplate = async () => {
    if (!composition || templateMode || componentMode) return;
    const name = window.prompt('Template name', `${composition.name} template`);
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      await runtime.saveCompositionRevision(composition.id, {
        document,
        documentVersion,
        label: 'pre-template',
      });
      const slots = templateSlots.length
        ? templateSlots
        : (document.layers || [])
            .filter((l) => l.role === 'headline' || l.role === 'body' || l.role === 'cta')
            .map((l) => ({
              id: newId(),
              type: 'text',
              role: l.role === 'headline' ? 'headline' : l.role === 'cta' ? 'cta' : 'body',
              required: l.role === 'headline',
              targetLayerId: l.id,
              defaultText: l.text || '',
            }));
      const res = await runtime.createTemplateFromComposition({
        compositionId: composition.id,
        name,
        category: templateCategory || 'custom',
        slots,
      });
      alert(`Saved Template: ${res.template?.id || 'ok'}`);
    } catch (e) {
      setError(e?.message || 'Save as Template failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateComponentFromLayers = async () => {
    if (!composition || templateMode || componentMode) return;
    if (!selectedId) {
      setError('Select a layer first');
      return;
    }
    const layer = document.layers.find((l) => l.id === selectedId);
    if (!layer || layer.type === 'component_instance') {
      setError('Select a text or image layer');
      return;
    }
    const name = window.prompt('Component name', `${layer.name || 'Component'}`);
    if (!name) return;
    const replace = window.confirm('Replace selected layers with a Component Instance?');
    setBusy(true);
    setError('');
    try {
      const res = await runtime.createComponentFromLayers({
        compositionId: composition.id,
        layerIds: [selectedId],
        name,
        replaceSelectedLayers: replace,
        documentVersion,
      });
      if (res.composition) {
        setComposition(res.composition);
        setDocument(res.composition.document);
        setDocumentVersion(res.composition.documentVersion);
        await cacheComponentRevisionDocs(res.composition.document);
      }
      alert(`Created Component: ${res.component?.id || 'ok'}`);
    } catch (e) {
      setError(e?.message || 'Create Component failed');
    } finally {
      setBusy(false);
    }
  };

  const handleInsertComponent = async () => {
    if (!composition || templateMode || componentMode) return;
    setBusy(true);
    setError('');
    try {
      const res = await runtime.listDesignComponents({ limit: 50 });
      const list = res?.components || [];
      if (!list.length) {
        setError('No components available');
        return;
      }
      const pick = window.prompt(
        `Insert Component (enter name):\n${list.map((c) => c.name).join('\n')}`,
        list[0].name
      );
      if (!pick) return;
      const component =
        list.find((c) => c.name === pick) || list.find((c) => c.id === pick);
      if (!component) {
        setError('Component not found');
        return;
      }
      const inserted = await runtime.instantiateDesignComponent({
        compositionId: composition.id,
        componentId: component.id,
        componentRevisionId: component.currentRevisionId,
        expectedDocumentVersion: documentVersion,
      });
      setComposition(inserted.composition);
      setDocument(inserted.composition.document);
      setDocumentVersion(inserted.composition.documentVersion);
      await cacheComponentRevisionDocs(inserted.composition.document);
      if (inserted.instance?.id) setSelectedId(inserted.instance.id);
    } catch (e) {
      setError(e?.message || 'Insert Component failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDetachInstance = async () => {
    if (!composition || !selectedLayer || selectedLayer.type !== 'component_instance') return;
    if (!window.confirm('Detach this Component Instance into ordinary layers?')) return;
    setBusy(true);
    setError('');
    try {
      const res = await runtime.detachComponentInstance({
        compositionId: composition.id,
        instanceLayerId: selectedLayer.id,
        expectedDocumentVersion: documentVersion,
      });
      setComposition(res.composition);
      setDocument(res.composition.document);
      setDocumentVersion(res.composition.documentVersion);
      setSelectedId(null);
    } catch (e) {
      setError(e?.message || 'Detach failed');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateInstanceRevision = async () => {
    if (!composition || !selectedLayer || selectedLayer.type !== 'component_instance') return;
    const targetRevisionId = componentHeads[selectedLayer.componentId];
    if (!targetRevisionId) return;
    setBusy(true);
    setError('');
    try {
      const res = await runtime.updateComponentInstanceRevision({
        compositionId: composition.id,
        instanceLayerId: selectedLayer.id,
        currentRevisionId: selectedLayer.componentRevisionId,
        targetRevisionId,
        expectedDocumentVersion: documentVersion,
      });
      setComposition(res.composition);
      setDocument(res.composition.document);
      setDocumentVersion(res.composition.documentVersion);
      await cacheComponentRevisionDocs(res.composition.document);
    } catch (e) {
      setError(e?.message || 'Update revision failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveComponentRevision = async () => {
    if (!componentMode || !document) return;
    setBusy(true);
    setError('');
    try {
      // Block nested component instances in component mode
      if ((document.layers || []).some((l) => l.type === 'component_instance')) {
        throw Object.assign(new Error('Component Documents cannot contain Component Instances'), {
          code: 'COMPONENT_NESTED_FORBIDDEN',
        });
      }
      const componentDoc = parseComponentDocument({
        version: DESIGN_COMPONENT_DOCUMENT_VERSION,
        intrinsicWidth: document.canvas.width,
        intrinsicHeight: document.canvas.height,
        layers: document.layers,
        properties: componentMeta?.revision?.document?.properties || [],
      });
      if (componentMeta?.component?.id) {
        await runtime.createDesignComponentRevision(componentMeta.component.id, {
          document: componentDoc,
          label: 'editor',
          activate: true,
        });
        if (componentName && componentName !== componentMeta.component.name) {
          await runtime.updateDesignComponent(componentMeta.component.id, {
            name: componentName,
          });
        }
        setSaveState('saved');
        alert('Component revision saved');
      } else {
        const created = await runtime.createDesignComponent({
          name: componentName || 'New Component',
          document: componentDoc,
          status: 'draft',
        });
        setComponentMeta({ component: created.component, revision: created.revision });
        setSaveState('saved');
        const q = new URLSearchParams({
          mode: 'component',
          componentId: created.component.id,
          componentRevisionId: created.revision.id,
        });
        window.history.replaceState({}, '', `/studio/apps/dynaxis.creative-editor?${q}`);
        alert('Component created');
      }
    } catch (e) {
      setError(e?.message || 'Component save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTemplateRevision = async () => {
    if (!templateMode || !templateMeta?.template) return;
    setBusy(true);
    setError('');
    try {
      const templateDocument = {
        version: 1,
        canvas: document.canvas,
        background: document.background,
        layers: document.layers,
        slots: templateSlots,
        adaptationHints: document.adaptationHints || null,
        brandHints: {
          brandBinding: templateMeta.template.brandBinding || 'neutral',
          brandId: templateMeta.template.brandId,
          brandRevisionId: templateMeta.template.brandRevisionId,
          preferPrimaryLogo: true,
          preferBrandFonts: true,
          preferBrandPalette: true,
        },
        formatMetadata: {
          aspectRatio: `${document.canvas.width}:${document.canvas.height}`,
        },
      };
      await runtime.createDesignTemplateRevision(templateMeta.template.id, {
        document: templateDocument,
        label: 'editor',
        activate: true,
      });
      if (templateName && templateName !== templateMeta.template.name) {
        await runtime.updateDesignTemplate(templateMeta.template.id, {
          name: templateName,
          category: templateCategory,
        });
      }
      setSaveState('saved');
      alert('Template revision saved');
    } catch (e) {
      setError(e?.message || 'Template save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleAdaptAspect = async () => {
    if (!composition || templateMode || componentMode) return;
    const choice = window.prompt(
      'Adapt to aspect (1:1, 9:16, or 16:9). Creates a NEW Composition — starting layout only.',
      '9:16'
    );
    if (!choice) return;
    const aspectRatio = choice.trim();
    setBusy(true);
    setError('');
    try {
      const res = await runtime.adaptComposition({
        compositionId: composition.id,
        targetAspectRatio: aspectRatio,
      });
      setAdaptWarnings(res.warnings || []);
      if (res.composition?.id) {
        window.location.href = `/studio/apps/dynaxis.creative-editor?compositionId=${res.composition.id}`;
      }
    } catch (e) {
      setError(e?.message || 'Adaptation failed');
    } finally {
      setBusy(false);
    }
  };

  const markLayerAsSlot = () => {
    if (!selectedLayer) return;
    const existing = templateSlots.find((s) => s.targetLayerId === selectedLayer.id);
    if (existing) {
      setTemplateSlots(templateSlots.filter((s) => s.id !== existing.id));
      return;
    }
    if (selectedLayer.type === 'text') {
      const role =
        selectedLayer.role === 'headline' ||
        selectedLayer.role === 'body' ||
        selectedLayer.role === 'cta'
          ? selectedLayer.role
          : 'custom_text';
      setTemplateSlots([
        ...templateSlots,
        {
          id: newId(),
          type: 'text',
          role: DESIGN_TEMPLATE_TEXT_ROLES.includes(role) ? role : 'custom_text',
          required: role === 'headline',
          targetLayerId: selectedLayer.id,
          defaultText: selectedLayer.text || '',
        },
      ]);
    } else if (selectedLayer.type === 'image') {
      const role =
        selectedLayer.role === 'product' ||
        selectedLayer.role === 'character' ||
        selectedLayer.role === 'brand_logo'
          ? selectedLayer.role
          : 'custom_image';
      setTemplateSlots([
        ...templateSlots,
        {
          id: newId(),
          type: 'image',
          role: DESIGN_TEMPLATE_IMAGE_ROLES.includes(role) ? role : 'custom_image',
          required: false,
          targetLayerId: selectedLayer.id,
          targetBackground: false,
          defaultAssetId: selectedLayer.assetId || null,
        },
      ]);
    }
  };

  const applyDocument = useCallback(
    (nextDoc, { recordUndo = true, autosave = true } = {}) => {
      setDocument(nextDoc);
      if (recordUndo) pushUndo(undoRef.current, nextDoc);
      if (autosave) scheduleSave(nextDoc, documentVersion);
    },
    [documentVersion, scheduleSave]
  );

  const updateLayer = useCallback(
    (id, patch) => {
      if (!document) return;
      const layers = document.layers.map((l) => (l.id === id ? { ...l, ...patch } : l));
      applyDocument({ ...document, layers });
    },
    [document, applyDocument]
  );

  const bindToken = useCallback(
    (property, tokenId) => {
      if (!selectedLayer) return;
      const tokenBindings = {
        ...(selectedLayer.tokenBindings || {}),
        [property]: { tokenId },
      };
      updateLayer(selectedLayer.id, { tokenBindings });
    },
    [selectedLayer, updateLayer]
  );

  const detachToken = useCallback(
    (property) => {
      if (!selectedLayer) return;
      const tokenBindings = { ...(selectedLayer.tokenBindings || {}) };
      delete tokenBindings[property];
      updateLayer(selectedLayer.id, {
        tokenBindings: Object.keys(tokenBindings).length ? tokenBindings : null,
      });
    },
    [selectedLayer, updateLayer]
  );

  const switchDesignMode = useCallback(
    (collectionId, modeId) => {
      if (!document) return;
      const designSystem = {
        ...(document.designSystem || {}),
        designSystemId:
          document.designSystem?.designSystemId ||
          composition?.designSystemId ||
          designSystemMeta?.designSystemId ||
          null,
        designSystemRevisionId:
          document.designSystem?.designSystemRevisionId ||
          composition?.designSystemRevisionId ||
          designSystemMeta?.revisionId ||
          null,
        modes: {
          ...(document.designSystem?.modes || {}),
          [collectionId]: modeId,
        },
      };
      applyDocument({ ...document, designSystem });
      if (composition && !String(composition.id).startsWith('design-system:')) {
        setComposition({ ...composition, designSystemModes: designSystem.modes });
      }
    },
    [document, composition, designSystemMeta, applyDocument]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (
        !selectedLayer ||
        selectedLayer.type !== 'component_instance' ||
        !selectedLayer.componentSetId ||
        !runtime?.getDesignComponentSet
      ) {
        setVariantAxes([]);
        setVariantMaps([]);
        return;
      }
      try {
        const res = await runtime.getDesignComponentSet(selectedLayer.componentSetId);
        if (cancelled) return;
        setVariantAxes(res?.componentSet?.variantAxes || []);
        setVariantMaps(res?.variants || []);
      } catch {
        if (!cancelled) {
          setVariantAxes([]);
          setVariantMaps([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedLayer, runtime]);

  const handleSwitchVariant = async (combination) => {
    if (!composition || !selectedLayer?.componentSetId) return;
    setBusy(true);
    setError('');
    try {
      const res = await runtime.switchComponentInstanceVariant({
        compositionId: composition.id,
        instanceLayerId: selectedLayer.id,
        combination,
        expectedDocumentVersion: documentVersion,
        dropIncompatibleOverrides: true,
      });
      setComposition(res.composition);
      setDocument(res.composition.document);
      setDocumentVersion(res.composition.documentVersion);
      await cacheComponentRevisionDocs(res.composition.document);
    } catch (e) {
      setError(e?.message || 'Variant switch failed');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    if (!composition) return;
    setBusy(true);
    setError('');
    try {
      await runtime.saveCompositionRevision(composition.id, {
        document,
        documentVersion,
        label: 'pre-export',
      });
      const res = await runtime.exportComposition(composition.id);
      if (composition.campaignDeliverableId) {
        await runtime.compositionAction(composition.id, {
          action: 'setFinalAsset',
          assetId: res.asset?.id,
        });
      }
      setError('');
      alert(`Exported Asset: ${res.asset?.id || 'ok'}`);
    } catch (e) {
      setError(e?.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCleanBackground = async () => {
    if (!composition || regenActive.current) return;
    regenActive.current = true;
    setRegenState('preparing');
    setError('');
    const previousBgId =
      document?.background?.kind === 'asset' ? document.background.assetId : null;
    try {
      const prep = await runtime.compositionAction(composition.id, {
        action: 'prepareCleanBackground',
      });
      setRegenState('queued');
      if (!runtime.createGeneration) {
        throw Object.assign(new Error('Host generation executor unavailable'), {
          code: 'GENERATION_HOST_UNAVAILABLE',
        });
      }
      setRegenState('generating');
      const gen = await runtime.createGeneration(prep.generationRequest);
      if (!gen?.executed) {
        throw Object.assign(
          new Error(gen?.message || 'Generation was not executed by host'),
          { code: 'GENERATION_NOT_EXECUTED' }
        );
      }
      const assetId = gen.assets?.[0]?.id || gen.assets?.[0]?.assetId;
      if (!assetId) {
        throw Object.assign(new Error('Generation completed without an Asset'), {
          code: 'GENERATION_NO_ASSET',
        });
      }
      const applied = await runtime.compositionAction(composition.id, {
        action: 'applyBackground',
        assetId,
        documentVersion,
      });
      const nextDoc = applied.composition.document;
      setComposition(applied.composition);
      setDocumentVersion(applied.composition.documentVersion);
      applyDocument(nextDoc, { recordUndo: true, autosave: false });
      await loadAssetUrls(nextDoc);
      setRegenState('completed');
      // previous background Asset intentionally retained (previousBgId)
      void previousBgId;
    } catch (e) {
      setRegenState('failed');
      setError(e?.message || 'Clean background failed');
      // Preserve current background / draft — do not apply
    } finally {
      regenActive.current = false;
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!document || !selectedId) return;
      const layer = document.layers.find((l) => l.id === selectedId);
      if (!layer || layer.locked) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const pos = nudgeLayer(layer, { dx: -step, dy: 0 }, layer, document.canvas);
        updateLayer(selectedId, pos);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const pos = nudgeLayer(layer, { dx: step, dy: 0 }, layer, document.canvas);
        updateLayer(selectedId, pos);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const pos = nudgeLayer(layer, { dx: 0, dy: -step }, layer, document.canvas);
        updateLayer(selectedId, pos);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const pos = nudgeLayer(layer, { dx: 0, dy: step }, layer, document.canvas);
        updateLayer(selectedId, pos);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const prev = undo(undoRef.current);
        if (prev) {
          setDocument(prev);
          scheduleSave(prev, documentVersion);
        }
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const next = redo(undoRef.current);
        if (next) {
          setDocument(next);
          scheduleSave(next, documentVersion);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [document, selectedId, documentVersion, scheduleSave, updateLayer]);

  if (busy && !composition) {
    return (
      <div className="h-full flex items-center justify-center text-white/40 text-sm">
        Loading editor…
      </div>
    );
  }

  if (!document || !composition) {
    return (
      <div className="h-full flex items-center justify-center text-amber-300/80 text-sm p-6">
        {error || 'No composition loaded'}
      </div>
    );
  }

  const cw = document.canvas.width;
  const ch = document.canvas.height;
  const bgUrl =
    document.background?.kind === 'asset' ? assetUrls[document.background.assetId] : null;

  return (
    <div className="h-full flex flex-col bg-[#050505] text-white">
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div>
          <h1 className="text-[13px] font-bold tracking-wide">{composition.name}</h1>
          <p className="text-[10px] text-white/40">
            {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save error' : 'Saved'} ·
            v{documentVersion}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            disabled={!canUndo(undoRef.current)}
            className="text-[10px] px-2 py-1 border border-white/15 rounded disabled:opacity-30"
            onClick={() => {
              const prev = undo(undoRef.current);
              if (prev) applyDocument(prev, { recordUndo: false });
            }}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!canRedo(undoRef.current)}
            className="text-[10px] px-2 py-1 border border-white/15 rounded disabled:opacity-30"
            onClick={() => {
              const next = redo(undoRef.current);
              if (next) applyDocument(next, { recordUndo: false });
            }}
          >
            Redo
          </button>
          <button
            type="button"
            className="text-[10px] px-2 py-1 border border-white/15 rounded"
            onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
          >
            −
          </button>
          <span className="text-[10px] text-white/50 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="text-[10px] px-2 py-1 border border-white/15 rounded"
            onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
          >
            +
          </button>
          <button
            type="button"
            disabled={busy || regenActive.current || regenState === 'generating' || regenState === 'preparing' || regenState === 'queued'}
            onClick={handleCleanBackground}
            className="h-8 px-3 rounded border border-white/20 text-white/80 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
            aria-label="Regenerate clean background without text"
          >
            {regenState === 'preparing'
              ? 'Preparing…'
              : regenState === 'queued'
                ? 'Queued…'
                : regenState === 'generating'
                  ? 'Generating…'
                  : regenState === 'failed'
                    ? 'Retry clean bg'
                    : 'Clean background'}
          </button>
          {!templateMode && !componentMode ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={handleAdaptAspect}
                className="h-8 px-3 rounded border border-white/20 text-white/80 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
                title="Creates a new Composition as a starting layout"
              >
                Adapt aspect
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCreateComponentFromLayers}
                className="h-8 px-3 rounded border border-white/20 text-white/80 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
              >
                Create Component
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleInsertComponent}
                className="h-8 px-3 rounded border border-white/20 text-white/80 text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
              >
                Insert Component
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveAsTemplate}
                className="h-8 px-3 rounded border border-[#22d3ee]/40 text-[#22d3ee] text-[10px] font-bold uppercase tracking-widest disabled:opacity-40"
              >
                Save as Template
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleExport}
                className="h-8 px-3 rounded bg-[#22d3ee] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
              >
                Export PNG
              </button>
            </>
          ) : componentMode ? (
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveComponentRevision}
              className="h-8 px-3 rounded bg-[#22d3ee] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Save Component
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveTemplateRevision}
              className="h-8 px-3 rounded bg-[#22d3ee] text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
            >
              Save Template
            </button>
          )}
        </div>
      </header>
      {error ? <p className="text-[11px] text-amber-300/90 px-4 py-1">{error}</p> : null}
      {adaptWarnings.length ? (
        <p className="text-[10px] text-white/50 px-4 py-1">
          Adaptation starting layout · {adaptWarnings.map((w) => w.code).join(', ')}
        </p>
      ) : null}
      <div className="flex flex-1 min-h-0">
        <aside className="w-48 border-r border-white/10 p-2 overflow-auto text-[11px]">
          <p className="text-white/40 uppercase tracking-widest text-[9px] mb-2">Layers</p>
          {[...document.layers].reverse().map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedId(l.id)}
              className={`w-full text-left px-2 py-1 rounded mb-1 ${
                selectedId === l.id ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              {l.name || l.role || l.type} {l.locked ? '🔒' : ''}
            </button>
          ))}
        </aside>
        <main className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[#0a0a0a]">
          <div
            className="relative shadow-2xl border border-white/10"
            style={{
              width: cw * zoom,
              height: ch * zoom,
              background: document.canvas.backgroundColor || '#111',
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
              {sortLayersForRender(previewLayers)
                .filter((l) => l.visible !== false)
                .map((layer) => {
                  const isExpandedChild = Boolean(layer.__fromInstance);
                  const interactiveId = isExpandedChild ? layer.__fromInstance : layer.id;
                  const sourceLayer = isExpandedChild
                    ? document.layers.find((l) => l.id === layer.__fromInstance)
                    : layer;
                  return (
                  <Rnd
                    key={layer.id}
                    size={{ width: layer.width, height: layer.height }}
                    position={{ x: layer.x, y: layer.y }}
                    bounds="parent"
                    disableDragging={isExpandedChild || layer.locked || sourceLayer?.locked}
                    enableResizing={!isExpandedChild && !layer.locked && !sourceLayer?.locked}
                    onDragStop={(_e, d) => {
                      if (isExpandedChild) return;
                      updateLayer(layer.id, { x: d.x, y: d.y });
                    }}
                    onResizeStop={(_e, _dir, ref, _delta, pos) => {
                      if (isExpandedChild) return;
                      updateLayer(layer.id, {
                        width: ref.offsetWidth,
                        height: ref.offsetHeight,
                        x: pos.x,
                        y: pos.y,
                      });
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(interactiveId);
                    }}
                    style={{
                      zIndex: layer.zIndex,
                      border:
                        selectedId === interactiveId
                          ? '1px solid rgba(34,211,238,0.8)'
                          : '1px solid transparent',
                      pointerEvents: isExpandedChild ? 'none' : undefined,
                    }}
                  >
                    <LayerPreview
                      layer={layer}
                      assetUrl={layer.type === 'image' ? assetUrls[layer.assetId] : null}
                    />
                  </Rnd>
                  );
                })}
            </div>
          </div>
        </main>
        <aside className="w-56 border-l border-white/10 p-3 text-[11px] space-y-3 overflow-auto">
          {designSystemPinned && tokenCollections.length ? (
            <div className="space-y-2 border-b border-white/10 pb-3">
              <p className="text-white/40 text-[9px] uppercase tracking-widest">Design modes</p>
              {tokenCollections.map((col) => (
                <label key={col.id} className="block">
                  <span className="text-white/40 text-[9px]">{col.name}</span>
                  <select
                    className="w-full mt-1 bg-black/40 border border-white/10 rounded p-1 text-[10px]"
                    value={
                      document?.designSystem?.modes?.[col.id] ||
                      composition?.designSystemModes?.[col.id] ||
                      col.defaultModeId ||
                      ''
                    }
                    onChange={(e) => switchDesignMode(col.id, e.target.value)}
                  >
                    {(col.modes || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          ) : null}
          {selectedLayer?.type === 'text' ? (
            <>
              <label className="block">
                <span className="text-white/40 text-[9px] uppercase">Text</span>
                <textarea
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded p-2 text-[11px] min-h-[72px]"
                  value={selectedLayer.text}
                  onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-white/40 text-[9px] uppercase">Font size</span>
                <input
                  type="number"
                  className="w-full mt-1 bg-black/40 border border-white/10 rounded p-1"
                  value={selectedLayer.fontSize}
                  onChange={(e) =>
                    updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) || 12 })
                  }
                />
              </label>
              <label className="block">
                <span className="text-white/40 text-[9px] uppercase">Colour</span>
                <input
                  type="color"
                  className="mt-1 w-full h-8"
                  value={selectedLayer.color?.startsWith('#') ? selectedLayer.color : '#ffffff'}
                  onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                />
              </label>
              {brandPalette.length ? (
                <div>
                  <span className="text-white/40 text-[9px] uppercase">Brand palette</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {brandPalette.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="w-6 h-6 rounded border border-white/20"
                        style={{ background: c }}
                        aria-label={`Brand colour ${c}`}
                        onClick={() => updateLayer(selectedLayer.id, { color: c })}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {designSystemPinned ? (
                <div className="border-t border-white/10 pt-2 space-y-2">
                  <p className="text-white/40 text-[9px] uppercase tracking-widest">Tokens</p>
                  <label className="block">
                    <span className="text-white/40 text-[9px]">Bind colour</span>
                    <select
                      className="w-full mt-1 bg-black/40 border border-white/10 rounded p-1 text-[10px]"
                      value={selectedLayer.tokenBindings?.color?.tokenId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) detachToken('color');
                        else bindToken('color', v);
                      }}
                    >
                      <option value="">— literal —</option>
                      {availableTokens
                        .filter((t) => t.type === 'colour')
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-white/40 text-[9px]">Bind font size</span>
                    <select
                      className="w-full mt-1 bg-black/40 border border-white/10 rounded p-1 text-[10px]"
                      value={selectedLayer.tokenBindings?.fontSize?.tokenId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) detachToken('fontSize');
                        else bindToken('fontSize', v);
                      }}
                    >
                      <option value="">— literal —</option>
                      {availableTokens
                        .filter((t) => t.type === 'number')
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div>
                <span className="text-white/40 text-[9px] uppercase">Align preset</span>
                <div className="grid grid-cols-3 gap-1 mt-1">
                  {POSITION_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className="text-[8px] py-1 border border-white/10 rounded hover:bg-white/5"
                      onClick={() => {
                        const pos = positionFromPreset(
                          p,
                          document.canvas,
                          { width: selectedLayer.width, height: selectedLayer.height },
                          document.canvas.safeArea || {}
                        );
                        updateLayer(selectedLayer.id, pos);
                      }}
                    >
                      {p.split('-')[0][0]}
                      {p.split('-')[1][0]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-white/40">Select a text layer to edit properties.</p>
          )}
          {(templateMode || true) && selectedLayer ? (
            <div className="border-t border-white/10 pt-3 space-y-2">
              {selectedLayer.type === 'component_instance' && !componentMode ? (
                <div className="space-y-2">
                  <p className="text-white/40 text-[9px] uppercase tracking-widest">Component instance</p>
                  {instanceUpdateAvailable ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="w-full h-7 rounded border border-amber-300/40 text-amber-200 text-[9px] font-bold uppercase tracking-widest disabled:opacity-40"
                      onClick={handleUpdateInstanceRevision}
                    >
                      Update available
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    className="w-full h-7 rounded border border-white/20 text-[9px] font-bold uppercase tracking-widest disabled:opacity-40"
                    onClick={handleDetachInstance}
                  >
                    Detach Instance
                  </button>
                  {selectedLayer.componentSetId && variantAxes.length ? (
                    <div className="space-y-1 pt-1">
                      <p className="text-white/40 text-[9px] uppercase tracking-widest">Variant</p>
                      {variantAxes.map((axis) => {
                        const current =
                          selectedLayer.variantProperties?.[axis.id] ||
                          '';
                        return (
                          <label key={axis.id} className="block">
                            <span className="text-white/40 text-[9px]">{axis.name}</span>
                            <select
                              className="w-full mt-1 bg-black/40 border border-white/10 rounded p-1 text-[10px]"
                              value={current}
                              disabled={busy}
                              onChange={(e) => {
                                const next = {
                                  ...(selectedLayer.variantProperties || {}),
                                  [axis.id]: e.target.value,
                                };
                                // Require full combination before switch
                                const complete = variantAxes.every((a) => next[a.id]);
                                if (complete) handleSwitchVariant(next);
                                else updateLayer(selectedLayer.id, { variantProperties: next });
                              }}
                            >
                              <option value="">—</option>
                              {(axis.values || []).map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                      {variantMaps.length ? (
                        <p className="text-[9px] text-white/30">{variantMaps.length} mapped variants</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <p className="text-white/40 text-[9px] uppercase tracking-widest">Template slot</p>
              <button
                type="button"
                className="w-full h-7 rounded border border-white/20 text-[9px] font-bold uppercase tracking-widest"
                onClick={markLayerAsSlot}
              >
                {templateSlots.some((s) => s.targetLayerId === selectedLayer.id)
                  ? 'Unmark slot'
                  : 'Mark as slot'}
              </button>
              {templateSlots
                .filter((s) => s.targetLayerId === selectedLayer.id)
                .map((slot) => (
                  <div key={slot.id} className="space-y-1">
                    <label className="block">
                      <span className="text-white/40 text-[9px]">Role</span>
                      <select
                        className="w-full mt-1 bg-black/40 border border-white/10 rounded p-1 text-[10px]"
                        value={slot.role}
                        onChange={(e) =>
                          setTemplateSlots(
                            templateSlots.map((s) =>
                              s.id === slot.id ? { ...s, role: e.target.value } : s
                            )
                          )
                        }
                      >
                        {(slot.type === 'text'
                          ? DESIGN_TEMPLATE_TEXT_ROLES
                          : DESIGN_TEMPLATE_IMAGE_ROLES
                        ).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-[10px]">
                      <input
                        type="checkbox"
                        checked={Boolean(slot.required)}
                        onChange={(e) =>
                          setTemplateSlots(
                            templateSlots.map((s) =>
                              s.id === slot.id ? { ...s, required: e.target.checked } : s
                            )
                          )
                        }
                      />
                      Required
                    </label>
                  </div>
                ))}
              {templateMode ? (
                <>
                  <label className="block">
                    <span className="text-white/40 text-[9px]">Template name</span>
                    <input
                      className="w-full mt-1 bg-black/40 border border-white/10 rounded p-1 text-[10px]"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  </label>
                  <p className="text-[9px] text-white/30">
                    {templateSlots.length} slot(s) · adaptation anchors optional on layers
                  </p>
                </>
              ) : null}
              {componentMode ? (
                <label className="block">
                  <span className="text-white/40 text-[9px]">Component name</span>
                  <input
                    className="w-full mt-1 bg-black/40 border border-white/10 rounded p-1 text-[10px]"
                    value={componentName}
                    onChange={(e) => setComponentName(e.target.value)}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
