'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { uploadFile } from 'studio';
import {
  CHARACTER_ASPECT_RATIOS,
  CHARACTER_RESOLUTIONS,
  CHARACTER_STUDIO_CATEGORIES,
  MAX_REFERENCE_IMAGES,
} from './presets.js';
import {
  generateCharacterPortrait,
  chatWithCharacter,
  promoteGeneratedPortrait,
} from './capability.js';

/**
 * AI Character Studio — Dynaxis shell styling.
 * Domain: persistent Characters + nano-banana-pro portraits + persona chat.
 */
export default function CharacterStudioMiniApp({ runtime, apiKey }) {
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState('library'); // library | create | generate | chat
  const [characters, setCharacters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [characterAssets, setCharacterAssets] = useState([]);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Create form
  const [form, setForm] = useState({
    name: '',
    description: '',
    persona: '',
    backstory: '',
    greeting: '',
    systemPrompt: '',
    category: 'Original',
  });

  // Generate
  const [visualPrompt, setVisualPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('1k');
  const [pendingRefs, setPendingRefs] = useState([]); // { url, assetId? }
  const [results, setResults] = useState(null);

  // Chat
  const [conversationId, setConversationId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');

  const projectCtx = useMemo(() => {
    try {
      return runtime.getProjectContext();
    } catch {
      return { projectId: null };
    }
  }, [runtime]);

  const refreshLibrary = useCallback(async () => {
    try {
      const data = await runtime.listCharacters();
      setCharacters(data?.characters || []);
    } catch (err) {
      setError(err?.message || 'Failed to load characters');
    }
  }, [runtime]);

  const loadCharacter = useCallback(
    async (id) => {
      if (!id) {
        setSelected(null);
        setCharacterAssets([]);
        return;
      }
      try {
        const data = await runtime.getCharacter(id, { includeAssets: 'true' });
        const character = data?.character || data;
        setSelected(character);
        const assetsRes = await runtime.listCharacterAssets(id);
        setCharacterAssets(assetsRes?.assets || []);
      } catch (err) {
        setError(err?.message || 'Failed to load character');
      }
    },
    [runtime]
  );

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    loadCharacter(selectedId);
  }, [selectedId, loadCharacter]);

  const selectCharacter = (id) => {
    setSelectedId(id);
    setResults(null);
    setConversationId(null);
    setChatMessages([]);
    setTab('generate');
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError('Character name is required');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const result = await runtime.createCharacter({
        ...form,
        projectId: projectCtx.projectId || undefined,
      });
      const character = result?.character;
      await refreshLibrary();
      if (character?.id) {
        setSelectedId(character.id);
        setTab('generate');
        setForm({
          name: '',
          description: '',
          persona: '',
          backstory: '',
          greeting: '',
          systemPrompt: '',
          category: 'Original',
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
    if (pendingRefs.length + files.length > MAX_REFERENCE_IMAGES) {
      setError(`At most ${MAX_REFERENCE_IMAGES} reference images.`);
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
          role: 'identity_reference',
          metadata: { characterStudioInput: true },
        });
        const assetId = registered?.asset?.id || registered?.id || null;
        next.push({ url, assetId });
        if (selectedId && assetId) {
          await runtime.addCharacterAsset(selectedId, {
            assetId,
            role: 'identity_reference',
            createRevision: true,
          });
        }
      }
      setPendingRefs(next);
      if (selectedId) await loadCharacter(selectedId);
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!selectedId) {
      setError('Select or create a Character first.');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      setStatusMessage('Generating character portrait…');
      setResults(null);
      const outcome = await generateCharacterPortrait(runtime, {
        characterId: selectedId,
        prompt: visualPrompt,
        aspectRatio,
        resolution,
        referenceAssets: pendingRefs.map((r) => ({
          url: r.url,
          assetId: r.assetId,
          role: 'identity_reference',
        })),
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
          characterRevisionId: outcome?.generation?.characterRevisionId,
        });
      }
      await loadCharacter(selectedId);
    } catch (err) {
      setError(err?.message || 'Portrait generation failed');
    } finally {
      setBusy(false);
      setStatusMessage('');
    }
  };

  const handlePromote = async (assetId) => {
    try {
      setBusy(true);
      await promoteGeneratedPortrait(runtime, selectedId, assetId, {
        role: 'identity_reference',
        isPrimary: true,
      });
      await loadCharacter(selectedId);
      setStatusMessage('Promoted to identity reference.');
    } catch (err) {
      setError(err?.message || 'Promote failed');
    } finally {
      setBusy(false);
    }
  };

  const handleStartChat = async () => {
    if (!selectedId) return;
    try {
      setBusy(true);
      setError(null);
      const started = await chatWithCharacter(runtime, {
        characterId: selectedId,
        includeGreeting: true,
      });
      setConversationId(started?.conversation?.id || null);
      setChatMessages(started?.messages || []);
      setTab('chat');
    } catch (err) {
      setError(err?.message || 'Chat start failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSendChat = async () => {
    if (!selectedId || !chatDraft.trim()) return;
    try {
      setBusy(true);
      setError(null);
      const result = await chatWithCharacter(runtime, {
        characterId: selectedId,
        conversationId,
        message: chatDraft.trim(),
      });
      if (result?.conversation?.id) setConversationId(result.conversation.id);
      if (result?.userMessage && result?.assistantMessage) {
        setChatMessages((prev) => [...prev, result.userMessage, result.assistantMessage]);
      } else if (result?.messages) {
        setChatMessages(result.messages);
      }
      setChatDraft('');
    } catch (err) {
      setError(err?.message || 'Chat failed');
    } finally {
      setBusy(false);
    }
  };

  const field = (label, key, multiline = false) =>
    React.createElement(
      'label',
      { key, className: 'block space-y-1.5' },
      React.createElement(
        'span',
        { className: 'text-[11px] font-bold uppercase tracking-wider text-white/35' },
        label
      ),
      multiline
        ? React.createElement('textarea', {
            value: form[key],
            onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
            rows: 3,
            className:
              'w-full rounded-md bg-black/50 border border-white/10 px-3 py-2 text-[13px] text-white/90',
          })
        : React.createElement('input', {
            value: form[key],
            onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
            className:
              'w-full h-10 rounded-md bg-black/50 border border-white/10 px-3 text-[13px] text-white/90',
          })
    );

  const tabs = [
    { id: 'library', label: 'Library' },
    { id: 'create', label: 'Create' },
    { id: 'generate', label: 'Portrait' },
    { id: 'chat', label: 'Chat' },
  ];

  return React.createElement(
    'div',
    {
      className:
        'h-full w-full bg-[#050505] text-white flex flex-col overflow-hidden',
    },
    React.createElement(
      'header',
      {
        className:
          'flex items-center justify-between gap-4 px-5 py-4 border-b border-white/[0.06]',
      },
      React.createElement(
        'div',
        null,
        React.createElement(
          'p',
          { className: 'text-[10px] font-bold uppercase tracking-widest text-white/30' },
          'Dynaxis module'
        ),
        React.createElement(
          'h1',
          { className: 'text-[16px] font-bold tracking-tight' },
          'AI Character Studio'
        ),
        React.createElement(
          'p',
          { className: 'text-[11px] text-white/40' },
          'Reference-based continuity · Characters persist across Projects'
        )
      ),
      React.createElement(
        'div',
        { className: 'flex gap-1' },
        tabs.map((t) =>
          React.createElement(
            'button',
            {
              key: t.id,
              type: 'button',
              onClick: () => setTab(t.id),
              className: `h-8 px-3 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                tab === t.id
                  ? 'bg-[#22d3ee]/15 text-[#22d3ee]'
                  : 'text-white/45 hover:text-white/70'
              }`,
            },
            t.label
          )
        )
      )
    ),
    error
      ? React.createElement(
          'div',
          {
            className:
              'mx-5 mt-3 rounded-md border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-200',
          },
          error
        )
      : null,
    statusMessage
      ? React.createElement(
          'div',
          { className: 'mx-5 mt-2 text-[12px] text-white/40' },
          statusMessage
        )
      : null,
    React.createElement(
      'div',
      { className: 'flex-1 min-h-0 flex flex-col lg:flex-row' },
      // Sidebar library
      React.createElement(
        'aside',
        {
          className:
            'w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-white/[0.06] overflow-y-auto p-4 space-y-2',
        },
        React.createElement(
          'p',
          { className: 'text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2' },
          'Character library'
        ),
        characters.length === 0
          ? React.createElement(
              'p',
              { className: 'text-[12px] text-white/35' },
              'No characters yet. Create one to begin.'
            )
          : characters.map((c) =>
              React.createElement(
                'button',
                {
                  key: c.id,
                  type: 'button',
                  onClick: () => selectCharacter(c.id),
                  className: `w-full text-left rounded-md px-3 py-2 border ${
                    selectedId === c.id
                      ? 'border-[#22d3ee]/30 bg-[#22d3ee]/10'
                      : 'border-white/5 hover:border-white/10'
                  }`,
                },
                React.createElement(
                  'div',
                  { className: 'text-[13px] font-semibold truncate' },
                  c.name
                ),
                React.createElement(
                  'div',
                  { className: 'text-[10px] text-white/35 uppercase tracking-wider' },
                  c.category || 'Character'
                )
              )
            )
      ),
      // Main
      React.createElement(
        'main',
        { className: 'flex-1 min-h-0 overflow-y-auto p-5 space-y-5' },
        tab === 'create'
          ? React.createElement(
              'div',
              { className: 'max-w-xl space-y-4' },
              React.createElement(
                'h2',
                { className: 'text-[14px] font-bold' },
                'Create Character'
              ),
              field('Name', 'name'),
              field('Description', 'description', true),
              field('Persona', 'persona', true),
              field('Backstory', 'backstory', true),
              field('Greeting', 'greeting', true),
              field('System prompt (optional)', 'systemPrompt', true),
              React.createElement(
                'label',
                { className: 'block space-y-1.5' },
                React.createElement(
                  'span',
                  {
                    className:
                      'text-[11px] font-bold uppercase tracking-wider text-white/35',
                  },
                  'Category'
                ),
                React.createElement(
                  'select',
                  {
                    value: form.category,
                    onChange: (e) => setForm((f) => ({ ...f, category: e.target.value })),
                    className:
                      'w-full h-10 rounded-md bg-black/50 border border-white/10 px-3 text-[13px]',
                  },
                  CHARACTER_STUDIO_CATEGORIES.map((c) =>
                    React.createElement(
                      'option',
                      { key: c, value: c, className: 'bg-[#0a0a0a]' },
                      c
                    )
                  )
                )
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  disabled: busy,
                  onClick: handleCreate,
                  className:
                    'h-10 px-4 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[12px] font-bold uppercase tracking-wider disabled:opacity-40',
                },
                busy ? 'Saving…' : 'Create character'
              )
            )
          : null,
        tab === 'library'
          ? React.createElement(
              'div',
              { className: 'space-y-3 max-w-2xl' },
              React.createElement(
                'h2',
                { className: 'text-[14px] font-bold' },
                selected ? selected.name : 'Select a Character'
              ),
              selected
                ? React.createElement(
                    'div',
                    { className: 'space-y-3 text-[13px] text-white/60' },
                    React.createElement('p', null, selected.description || 'No description'),
                    React.createElement(
                      'p',
                      { className: 'text-[11px] text-white/35' },
                      `Revision · ${selected.currentRevisionId || '—'} · Continuity: reference-based`
                    ),
                    React.createElement(
                      'div',
                      { className: 'flex gap-2' },
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          onClick: () => setTab('generate'),
                          className:
                            'h-9 px-3 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[11px] font-bold uppercase',
                        },
                        'Portrait'
                      ),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          onClick: handleStartChat,
                          className:
                            'h-9 px-3 rounded-md border border-white/10 text-[11px] font-bold uppercase text-white/70',
                        },
                        'Chat'
                      )
                    ),
                    characterAssets.length
                      ? React.createElement(
                          'div',
                          { className: 'grid grid-cols-3 gap-2 pt-2' },
                          characterAssets.map((link) => {
                            const url = link.asset?.url;
                            if (!url) return null;
                            return React.createElement(
                              'div',
                              { key: link.assetId, className: 'space-y-1' },
                              React.createElement('img', {
                                src: url,
                                alt: link.role,
                                className: 'w-full aspect-square object-cover rounded-md border border-white/10',
                              }),
                              React.createElement(
                                'p',
                                { className: 'text-[9px] uppercase tracking-wider text-white/30' },
                                link.role
                              )
                            );
                          })
                        )
                      : null
                  )
                : React.createElement(
                    'p',
                    { className: 'text-[13px] text-white/40' },
                    'Choose a Character from the library, or create a new one.'
                  )
            )
          : null,
        tab === 'generate'
          ? React.createElement(
              'div',
              { className: 'grid lg:grid-cols-2 gap-6' },
              React.createElement(
                'div',
                { className: 'space-y-4' },
                React.createElement(
                  'h2',
                  { className: 'text-[14px] font-bold' },
                  selected ? `Portrait · ${selected.name}` : 'Portrait generation'
                ),
                !selectedId
                  ? React.createElement(
                      'p',
                      { className: 'text-[12px] text-white/40' },
                      'Select a Character first.'
                    )
                  : null,
                React.createElement('textarea', {
                  value: visualPrompt,
                  onChange: (e) => setVisualPrompt(e.target.value),
                  placeholder: 'Visual description (wardrobe, setting, mood)…',
                  rows: 4,
                  className:
                    'w-full rounded-md bg-black/50 border border-white/10 px-3 py-2 text-[13px]',
                }),
                React.createElement(
                  'div',
                  { className: 'grid grid-cols-2 gap-3' },
                  React.createElement(
                    'label',
                    { className: 'block space-y-1.5' },
                    React.createElement(
                      'span',
                      {
                        className:
                          'text-[11px] font-bold uppercase tracking-wider text-white/35',
                      },
                      'Aspect'
                    ),
                    React.createElement(
                      'select',
                      {
                        value: aspectRatio,
                        onChange: (e) => setAspectRatio(e.target.value),
                        className:
                          'w-full h-10 rounded-md bg-black/50 border border-white/10 px-3 text-[13px]',
                      },
                      CHARACTER_ASPECT_RATIOS.map((a) =>
                        React.createElement(
                          'option',
                          { key: a, value: a, className: 'bg-[#0a0a0a]' },
                          a
                        )
                      )
                    )
                  ),
                  React.createElement(
                    'label',
                    { className: 'block space-y-1.5' },
                    React.createElement(
                      'span',
                      {
                        className:
                          'text-[11px] font-bold uppercase tracking-wider text-white/35',
                      },
                      'Resolution'
                    ),
                    React.createElement(
                      'select',
                      {
                        value: resolution,
                        onChange: (e) => setResolution(e.target.value),
                        className:
                          'w-full h-10 rounded-md bg-black/50 border border-white/10 px-3 text-[13px]',
                      },
                      CHARACTER_RESOLUTIONS.map((r) =>
                        React.createElement(
                          'option',
                          { key: r.value, value: r.value, className: 'bg-[#0a0a0a]' },
                          r.label
                        )
                      )
                    )
                  )
                ),
                React.createElement(
                  'div',
                  { className: 'space-y-2' },
                  React.createElement(
                    'span',
                    {
                      className:
                        'text-[11px] font-bold uppercase tracking-wider text-white/35',
                    },
                    `References (up to ${MAX_REFERENCE_IMAGES})`
                  ),
                  React.createElement('input', {
                    ref: fileInputRef,
                    type: 'file',
                    accept: 'image/png,image/jpeg,image/webp',
                    multiple: true,
                    onChange: handleUploadRefs,
                    className: 'block w-full text-[12px] text-white/50',
                  }),
                  pendingRefs.length
                    ? React.createElement(
                        'div',
                        { className: 'flex flex-wrap gap-2' },
                        pendingRefs.map((r, i) =>
                          React.createElement('img', {
                            key: `${r.url}-${i}`,
                            src: r.url,
                            alt: 'ref',
                            className:
                              'w-14 h-14 object-cover rounded border border-white/10',
                          })
                        )
                      )
                    : null
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    disabled: busy || !selectedId,
                    onClick: handleGenerate,
                    className:
                      'h-10 px-4 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[12px] font-bold uppercase tracking-wider disabled:opacity-40',
                  },
                  busy ? statusMessage || 'Working…' : 'Generate portrait'
                )
              ),
              React.createElement(
                'div',
                { className: 'space-y-3' },
                results?.urls?.length
                  ? results.urls.map((url, i) =>
                      React.createElement(
                        'div',
                        { key: url, className: 'space-y-2' },
                        React.createElement('img', {
                          src: url,
                          alt: `portrait-${i}`,
                          className:
                            'w-full rounded-md border border-white/10 object-cover',
                        }),
                        results.assets?.[i]?.id
                          ? React.createElement(
                              'button',
                              {
                                type: 'button',
                                onClick: () => handlePromote(results.assets[i].id),
                                className:
                                  'h-8 px-3 rounded-md border border-white/10 text-[11px] font-bold uppercase text-white/70',
                              },
                              'Promote to identity reference'
                            )
                          : null
                      )
                    )
                  : React.createElement(
                      'p',
                      { className: 'text-[12px] text-white/35' },
                      'Generated portraits appear here and register as Dynaxis Assets.'
                    )
              )
            )
          : null,
        tab === 'chat'
          ? React.createElement(
              'div',
              { className: 'max-w-2xl flex flex-col h-full min-h-[420px]' },
              React.createElement(
                'div',
                { className: 'flex items-center justify-between mb-3' },
                React.createElement(
                  'h2',
                  { className: 'text-[14px] font-bold' },
                  selected ? `Chat · ${selected.name}` : 'Character chat'
                ),
                selectedId && !conversationId
                  ? React.createElement(
                      'button',
                      {
                        type: 'button',
                        onClick: handleStartChat,
                        className:
                          'h-8 px-3 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[11px] font-bold uppercase',
                      },
                      'Start conversation'
                    )
                  : null
              ),
              React.createElement(
                'div',
                {
                  className:
                    'flex-1 overflow-y-auto space-y-3 rounded-md border border-white/[0.06] bg-black/30 p-4 mb-3',
                },
                chatMessages.length === 0
                  ? React.createElement(
                      'p',
                      { className: 'text-[12px] text-white/35' },
                      'Persona chat uses the Character system prompt and greeting. Not Agent Studio.'
                    )
                  : chatMessages.map((m) =>
                      React.createElement(
                        'div',
                        {
                          key: m.id,
                          className: `text-[13px] leading-relaxed ${
                            m.role === 'user' ? 'text-[#22d3ee]/90' : 'text-white/75'
                          }`,
                        },
                        React.createElement(
                          'span',
                          {
                            className:
                              'text-[9px] font-bold uppercase tracking-wider text-white/30 mr-2',
                          },
                          m.role
                        ),
                        m.content
                      )
                    )
              ),
              React.createElement(
                'div',
                { className: 'flex gap-2' },
                React.createElement('input', {
                  value: chatDraft,
                  onChange: (e) => setChatDraft(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  },
                  placeholder: 'Message your Character…',
                  disabled: !selectedId || busy,
                  className:
                    'flex-1 h-10 rounded-md bg-black/50 border border-white/10 px-3 text-[13px]',
                }),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    disabled: busy || !selectedId || !chatDraft.trim(),
                    onClick: handleSendChat,
                    className:
                      'h-10 px-4 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[12px] font-bold uppercase disabled:opacity-40',
                  },
                  'Send'
                )
              )
            )
          : null
      )
    )
  );
}
