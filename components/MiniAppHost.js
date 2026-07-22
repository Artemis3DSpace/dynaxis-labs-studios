'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { loadMiniApp } from '@/lib/dynaxis/mini-apps/loader';
import { createMiniAppRuntime } from '@/lib/dynaxis/mini-apps/runtime';
import { executeMiniAppMuapiGeneration } from '@/lib/dynaxis/mini-apps/execute-generation';
import { MiniAppErrorBoundary } from './MiniAppErrorBoundary';

/**
 * Lazy-loads and mounts a trusted Dynaxis Mini App with a permissioned runtime.
 * Generation defaults to Dynaxis MuAPI adapter (no double lifecycle).
 */
export default function MiniAppHost({ miniAppId, apiKey, executeGeneration, onClose }) {
  const [state, setState] = useState({
    status: 'loading',
    error: null,
    mod: null,
    manifest: null,
  });

  const executor = useMemo(
    () =>
      typeof executeGeneration === 'function'
        ? executeGeneration
        : executeMiniAppMuapiGeneration,
    [executeGeneration]
  );

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', error: null, mod: null, manifest: null });
    loadMiniApp(miniAppId)
      .then(({ module, manifest }) => {
        if (cancelled) return;
        setState({ status: 'ready', error: null, mod: module, manifest });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'error', error: err, mod: null, manifest: null });
      });
    return () => {
      cancelled = true;
    };
  }, [miniAppId]);

  if (state.status === 'loading') {
    return React.createElement(
      'div',
      {
        className:
          'h-full w-full bg-black flex items-center justify-center text-white/20 text-sm',
      },
      'Loading Mini App…'
    );
  }

  if (state.status === 'error') {
    return React.createElement(
      'div',
      {
        className: 'h-full w-full flex items-center justify-center bg-[#050505] p-8',
      },
      React.createElement(
        'div',
        { className: 'max-w-md text-center' },
        React.createElement(
          'p',
          { className: 'text-[13px] font-bold text-amber-300 mb-2' },
          'Unable to open Mini App'
        ),
        React.createElement(
          'p',
          { className: 'text-[12px] text-white/50' },
          String(state.error?.message || 'Load failed').slice(0, 300)
        ),
        onClose
          ? React.createElement(
              'button',
              {
                type: 'button',
                onClick: onClose,
                className:
                  'mt-4 h-9 px-4 rounded-md bg-white/5 text-[12px] font-semibold text-white/80',
              },
              'Back to Apps'
            )
          : null
      )
    );
  }

  const runtime = createMiniAppRuntime({
    manifest: state.manifest,
    apiKey,
    executeGeneration: executor,
    invokeCapability: state.mod?.invokeCapability,
  });

  const Component = state.mod?.Component || state.mod?.default;
  if (!Component) {
    return React.createElement(
      'div',
      {
        className:
          'h-full w-full flex items-center justify-center text-white/40 text-sm',
      },
      'Mini App entrypoint missing Component export'
    );
  }

  return React.createElement(
    MiniAppErrorBoundary,
    { miniAppId, onReset: onClose },
    React.createElement(
      'div',
      { className: 'h-full w-full relative' },
      onClose
        ? React.createElement(
            'button',
            {
              type: 'button',
              onClick: onClose,
              className:
                'absolute top-3 right-3 z-10 h-8 px-3 rounded-md border border-white/10 bg-black/50 text-[11px] font-semibold text-white/70 hover:text-white',
            },
            'Close'
          )
        : null,
      React.createElement(Component, { runtime, apiKey })
    )
  );
}
