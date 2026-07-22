'use client';

import React from 'react';

/**
 * Isolates Mini App render failures from the Dynaxis shell.
 */
export class MiniAppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const miniAppId = this.props.miniAppId || 'unknown';
    console.error(`[Dynaxis MiniApp:${miniAppId}] render error`, error, info?.componentStack);
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, { miniAppId, info });
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.error)
          : this.props.fallback;
      }
      return React.createElement(
        'div',
        {
          className:
            'h-full w-full flex items-center justify-center bg-[#050505] p-8',
          'data-dynaxis-mini-app-error': '1',
        },
        React.createElement(
          'div',
          {
            className:
              'max-w-md border border-red-500/30 bg-red-500/5 rounded-lg p-6 text-center',
          },
          React.createElement(
            'p',
            { className: 'text-[13px] font-bold text-red-300 mb-2' },
            'Mini App failed to render'
          ),
          React.createElement(
            'p',
            { className: 'text-[12px] text-white/50 leading-relaxed' },
            String(this.state.error?.message || 'Unexpected error').slice(0, 240)
          ),
          React.createElement(
            'p',
            { className: 'text-[11px] text-white/30 mt-3' },
            'The Dynaxis Labs Studios shell remains available. Try another studio or reopen Apps.'
          ),
          typeof this.props.onReset === 'function'
            ? React.createElement(
                'button',
                {
                  type: 'button',
                  className:
                    'mt-4 h-9 px-4 rounded-md bg-white/5 text-[12px] font-semibold text-white/80 hover:bg-white/10',
                  onClick: () => {
                    this.setState({ error: null });
                    this.props.onReset();
                  },
                },
                'Dismiss'
              )
            : null
        )
      );
    }
    return this.props.children;
  }
}
