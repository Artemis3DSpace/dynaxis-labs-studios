'use client';

import React, { useState } from 'react';
import { buildExampleGenerationPlan } from './capability.js';

/**
 * Minimal UI surface over the example capability.
 * Not a production Mini App — framework demonstration only.
 */
export default function ExampleMiniApp({ runtime }) {
  const [prompt, setPrompt] = useState('A simple geometric mark on a dark field');
  const [log, setLog] = useState('');
  const [busy, setBusy] = useState(false);

  const handleInspect = async () => {
    try {
      const ctx = runtime.getProjectContext();
      setLog(JSON.stringify(ctx, null, 2));
    } catch (err) {
      setLog(String(err.message || err));
    }
  };

  const handlePlan = () => {
    try {
      const plan = buildExampleGenerationPlan({ prompt });
      setLog(JSON.stringify(plan, null, 2));
    } catch (err) {
      setLog(String(err.message || err));
    }
  };

  const handleListAssets = async () => {
    setBusy(true);
    try {
      const data = await runtime.listAssets({ limit: 5 });
      setLog(JSON.stringify(data, null, 2));
    } catch (err) {
      setLog(String(err.message || err));
    } finally {
      setBusy(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'h-full w-full bg-[#050505] text-white p-6 overflow-auto' },
    React.createElement(
      'div',
      { className: 'max-w-xl mx-auto space-y-4' },
      React.createElement(
        'div',
        null,
        React.createElement(
          'p',
          { className: 'text-[10px] font-bold uppercase tracking-widest text-white/30' },
          'Framework template'
        ),
        React.createElement(
          'h1',
          { className: 'text-lg font-bold text-white mt-1' },
          'Dynaxis Example Module'
        ),
        React.createElement(
          'p',
          { className: 'text-[13px] text-white/45 mt-1 leading-relaxed' },
          'Demonstrates Mini App runtime access to project context, assets, and generation contracts. Not a production app.'
        )
      ),
      React.createElement(
        'label',
        { className: 'block' },
        React.createElement(
          'span',
          { className: 'text-[11px] font-bold text-white/35 uppercase tracking-wider' },
          'Prompt'
        ),
        React.createElement('textarea', {
          value: prompt,
          onChange: (e) => setPrompt(e.target.value),
          className:
            'mt-2 w-full h-24 rounded-md bg-black/40 border border-white/10 p-3 text-[13px] text-white/90',
        })
      ),
      React.createElement(
        'div',
        { className: 'flex flex-wrap gap-2' },
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handleInspect,
            className:
              'h-9 px-3 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[12px] font-bold',
          },
          'Read project context'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handlePlan,
            className:
              'h-9 px-3 rounded-md bg-white/5 text-white/80 text-[12px] font-bold border border-white/10',
          },
          'Build generation plan'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            disabled: busy,
            onClick: handleListAssets,
            className:
              'h-9 px-3 rounded-md bg-white/5 text-white/80 text-[12px] font-bold border border-white/10 disabled:opacity-40',
          },
          'List project assets'
        )
      ),
      log
        ? React.createElement(
            'pre',
            {
              className:
                'text-[11px] leading-relaxed text-white/55 bg-black/50 border border-white/5 rounded-md p-3 overflow-auto max-h-64',
            },
            log
          )
        : null
    )
  );
}
