'use client';

/**
 * Dynaxis Labs Studios — primary web application shell.
 * Hosts existing studio packages; does not reimplement generation logic.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ImageStudio,
  VideoStudio,
  ClippingStudio,
  VibeMotionStudio,
  LipSyncStudio,
  RecastStudio,
  CinemaStudio,
  AudioStudio,
  MarketingStudio,
  WorkflowStudio,
  AgentStudio,
  AppsStudio,
  AiInfluencerStudio,
  getUserBalance,
} from 'studio';
import axios from 'axios';
import ApiKeyModal from './ApiKeyModal';
import MiniAppHost from './MiniAppHost';
import {
  DYNAXIS_PRODUCT,
  getShellNavigation,
  getShellViewIds,
  getFeatureByViewId,
  getApiKey,
  setApiKey,
  clearApiKey,
  createPlatformClient,
  getStoredActiveProjectId,
  setStoredActiveProjectId,
  publishProjectContext,
  collectLocalHistoryEntries,
} from '@/lib/dynaxis/client';
import {
  bootstrapMiniAppRegistry,
  miniAppRegistry,
  checkMiniAppAvailability,
} from '@/lib/dynaxis/mini-apps';

const DesignAgentStudio = dynamic(
  () => import('studio').then((mod) => mod.DesignAgentStudio),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-black flex items-center justify-center text-white/20">
        Loading Design Studio...
      </div>
    ),
  }
);

const McpCliStudio = dynamic(
  () => import('studio').then((mod) => mod.McpCliStudio),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-black flex items-center justify-center text-white/20">
        Loading integrations...
      </div>
    ),
  }
);

const SHELL_NAV = getShellNavigation();
const SHELL_VIEW_IDS = getShellViewIds();

export default function StandaloneShell() {
  const params = useParams();
  const slug = params?.slug || [];
  const idFromParams = params?.id;
  const tabFromParams = params?.tab;

  const getWorkflowInfo = useCallback(() => {
    if (idFromParams) {
      return { id: idFromParams, tab: tabFromParams || null };
    }
    const wfIndex = slug.findIndex((s) => s === 'workflows' || s === 'workflow');
    if (wfIndex === -1) return { id: null, tab: null };
    return {
      id: slug[wfIndex + 1] || null,
      tab: slug[wfIndex + 2] || null,
    };
  }, [slug, idFromParams, tabFromParams]);

  const { id: urlWorkflowId } = getWorkflowInfo();

  const getInitialTab = () => {
    if (idFromParams || slug.includes('workflow')) return 'workflows';
    if (slug.includes('agents')) return 'agents';
    if (slug.includes('design-agent')) return 'design-agent';
    if (slug.includes('apps')) return 'apps';
    if (slug.includes('mcp-cli')) return 'mcp-cli';
    const firstSegment = slug[0];
    if (firstSegment && SHELL_VIEW_IDS.includes(firstSegment)) return firstSegment;
    return 'image';
  };

  const [apiKey, setApiKeyState] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [balance, setBalance] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [navSectionOpen, setNavSectionOpen] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [platformStatus, setPlatformStatus] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [historyImportNote, setHistoryImportNote] = useState(null);
  const [activeMiniAppId, setActiveMiniAppId] = useState(null);
  const [integratedModules, setIntegratedModules] = useState([]);
  const activeTabRef = useRef(null);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const pushNotification = useCallback((notif) => {
    const id = `notif-${Date.now()}-${Math.random()}`;
    const entry = { ...notif, id };
    setNotifications((prev) => [entry, ...prev].slice(0, 5));
    const ttl = notif.type === 'success' ? 8000 : 6000;
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), ttl);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const makeSuccessCallback = useCallback(
    (tabId) => (data) => {
      const feature = getFeatureByViewId(tabId);
      pushNotification({
        type: 'success',
        tabId,
        label: feature?.name || tabId,
        data,
      });
    },
    [pushNotification]
  );

  const makeErrorCallback = useCallback(
    (tabId) => (message) => {
      const feature = getFeatureByViewId(tabId);
      pushNotification({
        type: 'error',
        tabId,
        label: feature?.name || tabId,
        message,
      });
    },
    [pushNotification]
  );

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const segments = path.split('/').filter(Boolean);
      const tabId = segments[1] || 'image';
      if (SHELL_VIEW_IDS.includes(tabId)) {
        setActiveTab(tabId);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tabId) => {
    window.history.pushState(null, '', `/studio/${tabId}`);
    setActiveTab(tabId);
    setNavSectionOpen(null);
  };

  const handleTabClick = (e, tabId) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleTabChange(tabId);
    }
  };

  useEffect(() => {
    const isEditingWorkflow =
      (activeTab === 'workflows' || !!idFromParams) && urlWorkflowId;
    const isDesignAgent = activeTab === 'design-agent';

    if (isEditingWorkflow || isDesignAgent) {
      setIsHeaderVisible(false);
    } else {
      setIsHeaderVisible(true);
    }
  }, [activeTab, urlWorkflowId, idFromParams]);

  useEffect(() => {
    const fromBuilder = sessionStorage.getItem('fromWorkflowBuilder');
    const fromDesignAgent = sessionStorage.getItem('fromDesignAgent');

    if (
      (fromBuilder && activeTab !== 'workflows') ||
      (fromDesignAgent && activeTab !== 'design-agent')
    ) {
      sessionStorage.removeItem('fromWorkflowBuilder');
      sessionStorage.removeItem('fromDesignAgent');
      window.location.reload();
    }
  }, [activeTab]);

  const fetchBalance = useCallback(async (key) => {
    if (!key || key === 'dynaxis-local-preview') {
      setBalance(null);
      return;
    }
    try {
      const data = await getUserBalance(key);
      setBalance(data.balance);
    } catch (err) {
      console.error('Balance fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
    const stored = getApiKey();
    if (stored) {
      setApiKeyState(stored);
      // Re-sync cookie + design-agent token mirror via central session helper
      setApiKey(stored);
      fetchBalance(stored);
    }
  }, [fetchBalance]);

  const handleKeySave = useCallback(
    (key) => {
      setApiKey(key);
      setApiKeyState(key);
      fetchBalance(key);
    },
    [fetchBalance]
  );

  const handleKeyChange = useCallback(() => {
    clearApiKey();
    setApiKeyState(null);
    setBalance(null);
  }, []);

  useEffect(() => {
    delete axios.defaults.headers.common['x-api-key'];

    if (!apiKey) return;

    const interceptorId = axios.interceptors.request.use((config) => {
      const isRelative = config.url.startsWith('/') || !config.url.startsWith('http');
      const isInternalProxy =
        config.url.includes('/api/app') ||
        config.url.includes('/api/workflow') ||
        config.url.includes('/api/agents') ||
        config.url.includes('/api/api') ||
        config.url.includes('/api/v1') ||
        config.url.includes('/api/dynaxis');

      if (isRelative || isInternalProxy) {
        config.headers['x-api-key'] = apiKey;
      }

      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptorId);
    };
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) return;
    const interval = setInterval(() => fetchBalance(apiKey), 30000);
    return () => clearInterval(interval);
  }, [apiKey, fetchBalance]);

  const refreshProjects = useCallback(async (key) => {
    if (!key || key === 'dynaxis-local-preview') {
      setProjects([]);
      setPlatformStatus(null);
      return;
    }
    const client = createPlatformClient(key);
    try {
      const health = await client.health();
      setPlatformStatus(health);
      if (!health?.ok) {
        setProjects([]);
        return;
      }
      const data = await client.listProjects({ ensureDefault: 'true' });
      const list = data.projects || [];
      setProjects(list);
      const stored = getStoredActiveProjectId();
      const preferred =
        list.find((p) => p.id === stored) ||
        list.find((p) => p.isDefault) ||
        list[0] ||
        null;
      if (preferred) {
        setActiveProjectId(preferred.id);
        setStoredActiveProjectId(preferred.id);
        publishProjectContext({ projectId: preferred.id, project: preferred });
      }
    } catch (err) {
      console.warn('[Dynaxis] platform projects unavailable:', err?.message || err);
      setPlatformStatus({ ok: false, persistence: 'unavailable' });
    }
  }, []);

  useEffect(() => {
    if (apiKey) refreshProjects(apiKey);
  }, [apiKey, refreshProjects]);

  useEffect(() => {
    bootstrapMiniAppRegistry();
    const client = apiKey ? createPlatformClient(apiKey) : null;
    let cancelled = false;
    (async () => {
      let databaseOk = false;
      try {
        if (client) {
          const health = await client.health();
          databaseOk = Boolean(health?.ok);
        }
      } catch {
        databaseOk = false;
      }
      if (cancelled) return;
      const mods = miniAppRegistry.listUserVisible().map((m) => ({
        ...m,
        availability: checkMiniAppAvailability(m, {
          databaseOk,
          muapiKeyPresent: Boolean(apiKey) && apiKey !== 'dynaxis-local-preview',
          projectContextPresent: Boolean(activeProjectId),
        }),
      }));
      setIntegratedModules(mods);
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, activeProjectId]);

  useEffect(() => {
    const feature = getFeatureByViewId(activeTab);
    const assetHintMap = {
      image: 'image',
      cinema: 'image',
      'ai-influencer': 'image',
      marketing: 'image',
      video: 'video',
      lipsync: 'video',
      clipping: 'video',
      'vibe-motion': 'video',
      'body-swap': 'video',
      audio: 'audio',
    };
    if (typeof window !== 'undefined') {
      window.__dynaxisAssetHint = assetHintMap[activeTab] || null;
    }
    publishProjectContext({
      projectId: activeProjectId,
      featureId: feature?.id || null,
    });
  }, [activeTab, activeProjectId]);

  const handleProjectSelect = useCallback(
    (projectId) => {
      setActiveProjectId(projectId);
      setStoredActiveProjectId(projectId);
      const project = projects.find((p) => p.id === projectId) || null;
      publishProjectContext({ projectId, project });
    },
    [projects]
  );

  const handleCreateProject = useCallback(async () => {
    const name = newProjectName.trim();
    if (!name || !apiKey) return;
    try {
      const client = createPlatformClient(apiKey);
      const { project } = await client.createProject({ name });
      setNewProjectName('');
      await refreshProjects(apiKey);
      if (project?.id) handleProjectSelect(project.id);
    } catch (err) {
      pushNotification({
        type: 'error',
        tabId: activeTab,
        label: 'Project',
        message: err?.message || 'Could not create project',
      });
    }
  }, [apiKey, newProjectName, refreshProjects, handleProjectSelect, pushNotification, activeTab]);

  const handleImportLocalHistory = useCallback(async () => {
    if (!apiKey) return;
    try {
      const entries = collectLocalHistoryEntries();
      if (entries.length === 0) {
        setHistoryImportNote('No local studio history entries found to import.');
        return;
      }
      const client = createPlatformClient(apiKey);
      const summary = await client.importHistory({
        projectId: activeProjectId,
        entries,
      });
      setHistoryImportNote(
        `Imported ${summary.imported}, skipped ${summary.skipped}, failed ${summary.failed}. Local hg_* history was not deleted.`
      );
    } catch (err) {
      setHistoryImportNote(err?.message || 'Import failed (is DATABASE_URL configured?)');
    }
  }, [apiKey, activeProjectId]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
    }
  }, []);

  const handleFilesHandled = useCallback(() => {
    setDroppedFiles(null);
  }, []);

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-spin text-[#22d3ee] text-3xl">◌</div>
      </div>
    );
  }

  if (!apiKey) {
    const isLocalHost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    return (
      <ApiKeyModal
        onSave={handleKeySave}
        allowLocalPreview={isLocalHost}
        title={DYNAXIS_PRODUCT.name}
        subtitle={
          <>
            Enter your{' '}
            <a
              href={DYNAXIS_PRODUCT.providers.muapi.accessKeysUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[#22d3ee] hover:text-white transition-colors"
            >
              {DYNAXIS_PRODUCT.providers.muapi.name}
            </a>{' '}
            API key to start creating
          </>
        }
      />
    );
  }

  return (
    <div
      className="h-screen bg-[#030303] flex flex-col overflow-hidden text-white relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-[#22d3ee]/10 backdrop-blur-md border-4 border-dashed border-[#22d3ee]/50 flex items-center justify-center pointer-events-none transition-all duration-300">
          <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-4 scale-110 animate-pulse">
            <div className="w-20 h-20 bg-[#22d3ee] rounded-2xl flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-white">Drop your media here</span>
              <span className="text-sm text-white/40">Images, videos, or audio files</span>
            </div>
          </div>
        </div>
      )}

      {isHeaderVisible && (
        <header className="flex-shrink-0 border-b border-white/[0.06] bg-black/40 backdrop-blur-md z-40">
          <div className="h-14 flex items-center justify-between px-4 sm:px-6 gap-3">
            <div className="flex-shrink-0 flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-md overflow-hidden border border-white/10 bg-[#0a0a0a] flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/banner.png"
                  alt={DYNAXIS_PRODUCT.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 hidden sm:block">
                <div className="text-[13px] font-bold tracking-tight text-white truncate leading-tight">
                  {DYNAXIS_PRODUCT.shortName}
                </div>
                <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-white/35 truncate leading-tight">
                  Labs Studios
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 relative overflow-hidden h-full flex items-center">
              <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#030303] to-transparent pointer-events-none z-10 md:hidden" />
              <nav
                className="flex items-stretch gap-1 overflow-x-auto scrollbar-none w-full h-full px-1"
                aria-label="Dynaxis Labs Studios"
              >
                {SHELL_NAV.map((section) => {
                  const sectionActive = section.items.some((item) => item.id === activeTab);
                  const open = navSectionOpen === section.id;
                  return (
                    <div key={section.id} className="relative flex-shrink-0 flex items-center">
                      <button
                        type="button"
                        onClick={() =>
                          setNavSectionOpen((prev) => (prev === section.id ? null : section.id))
                        }
                        className={`h-9 px-3 rounded-md text-[12px] font-semibold tracking-wide transition-colors whitespace-nowrap ${
                          sectionActive || open
                            ? 'text-[#22d3ee] bg-[#22d3ee]/10'
                            : 'text-white/55 hover:text-white hover:bg-white/5'
                        }`}
                        aria-expanded={open}
                        aria-haspopup="true"
                      >
                        {section.label}
                      </button>
                      {open && (
                        <div className="absolute top-full left-0 mt-1 min-w-[200px] max-w-[280px] py-2 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl z-50">
                          <div className="px-3 pb-2 mb-1 border-b border-white/5">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                              {section.label}
                            </p>
                            <p className="text-[11px] text-white/40 leading-snug mt-0.5">
                              {section.description}
                            </p>
                          </div>
                          {section.items.map((item) => (
                            <a
                              key={item.id}
                              href={item.href}
                              onClick={(e) => handleTabClick(e, item.id)}
                              className={`flex items-start gap-2 px-3 py-2 text-left transition-colors ${
                                activeTab === item.id
                                  ? 'bg-[#22d3ee]/10 text-[#22d3ee]'
                                  : 'text-white/75 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <span className="text-[13px] font-medium leading-tight">
                                {item.label}
                              </span>
                              {item.capabilityType === 'catalogue' && (
                                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-amber-400/80 border border-amber-400/20 px-1.5 py-0.5 rounded">
                                  Catalogue
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
              <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#030303] to-transparent pointer-events-none z-10 md:hidden" />
            </div>

            <div className="flex-shrink-0 flex items-center gap-3">
              {projects.length > 0 && (
                <label className="hidden md:flex items-center gap-2 bg-white/5 px-2.5 py-1.5 rounded-md border border-white/5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                    Project
                  </span>
                  <select
                    value={activeProjectId || ''}
                    onChange={(e) => handleProjectSelect(e.target.value)}
                    className="bg-transparent text-[12px] font-medium text-white/90 outline-none max-w-[140px]"
                    aria-label="Active project"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-[#0a0a0a] text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex items-center gap-2.5 bg-white/5 px-3 py-1.5 rounded-md border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-white/90 tabular-nums">
                  ${balance !== null ? `${balance}` : '—'}
                </span>
              </div>

              <button
                onClick={() => setShowSettings(true)}
                title="Settings — API key and preferences"
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-white/5 text-[12px] font-bold text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span className="hidden sm:inline">Settings</span>
              </button>
            </div>
          </div>

          {/* Active feature strip */}
          <div className="h-9 px-4 sm:px-6 flex items-center gap-3 border-t border-white/[0.03] bg-black/20 overflow-x-auto scrollbar-none">
            {SHELL_NAV.flatMap((section) =>
              section.items.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => handleTabClick(e, item.id)}
                  className={`relative text-[11px] font-medium whitespace-nowrap px-1 py-2 transition-colors ${
                    activeTab === item.id
                      ? 'text-[#22d3ee]'
                      : 'text-white/40 hover:text-white/80'
                  }`}
                >
                  {item.label}
                  {activeTab === item.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#22d3ee] rounded-full" />
                  )}
                </a>
              ))
            )}
          </div>
        </header>
      )}

      {/* Close section menus on outside click */}
      {navSectionOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 cursor-default"
          aria-label="Close navigation menu"
          onClick={() => setNavSectionOpen(null)}
        />
      )}

      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div className={activeTab === 'image' ? 'h-full w-full' : 'hidden'}>
          <ImageStudio
            apiKey={apiKey}
            droppedFiles={droppedFiles}
            onFilesHandled={handleFilesHandled}
            onGenerationComplete={makeSuccessCallback('image')}
            onGenerationError={makeErrorCallback('image')}
          />
        </div>
        <div className={activeTab === 'video' ? 'h-full w-full' : 'hidden'}>
          <VideoStudio
            apiKey={apiKey}
            droppedFiles={droppedFiles}
            onFilesHandled={handleFilesHandled}
            onGenerationComplete={makeSuccessCallback('video')}
            onGenerationError={makeErrorCallback('video')}
          />
        </div>
        <div className={activeTab === 'clipping' ? 'h-full w-full' : 'hidden'}>
          <ClippingStudio
            apiKey={apiKey}
            droppedFiles={droppedFiles}
            onFilesHandled={handleFilesHandled}
            onGenerationComplete={makeSuccessCallback('clipping')}
            onGenerationError={makeErrorCallback('clipping')}
          />
        </div>
        <div className={activeTab === 'vibe-motion' ? 'h-full w-full' : 'hidden'}>
          <VibeMotionStudio
            apiKey={apiKey}
            onGenerationComplete={makeSuccessCallback('vibe-motion')}
            onGenerationError={makeErrorCallback('vibe-motion')}
          />
        </div>
        <div className={activeTab === 'lipsync' ? 'h-full w-full' : 'hidden'}>
          <LipSyncStudio
            apiKey={apiKey}
            droppedFiles={droppedFiles}
            onFilesHandled={handleFilesHandled}
            onGenerationComplete={makeSuccessCallback('lipsync')}
            onGenerationError={makeErrorCallback('lipsync')}
          />
        </div>
        <div className={activeTab === 'body-swap' ? 'h-full w-full' : 'hidden'}>
          <RecastStudio
            apiKey={apiKey}
            droppedFiles={droppedFiles}
            onFilesHandled={handleFilesHandled}
            onGenerationComplete={makeSuccessCallback('body-swap')}
            onGenerationError={makeErrorCallback('body-swap')}
          />
        </div>
        <div className={activeTab === 'cinema' ? 'h-full w-full' : 'hidden'}>
          <CinemaStudio
            apiKey={apiKey}
            onGenerationComplete={makeSuccessCallback('cinema')}
            onGenerationError={makeErrorCallback('cinema')}
          />
        </div>
        <div className={activeTab === 'audio' ? 'h-full w-full' : 'hidden'}>
          <AudioStudio
            apiKey={apiKey}
            droppedFiles={droppedFiles}
            onFilesHandled={handleFilesHandled}
            onGenerationComplete={makeSuccessCallback('audio')}
            onGenerationError={makeErrorCallback('audio')}
          />
        </div>
        <div className={activeTab === 'marketing' ? 'h-full w-full' : 'hidden'}>
          <MarketingStudio
            apiKey={apiKey}
            droppedFiles={droppedFiles}
            onFilesHandled={handleFilesHandled}
            onGenerationComplete={makeSuccessCallback('marketing')}
            onGenerationError={makeErrorCallback('marketing')}
          />
        </div>
        <div className={activeTab === 'workflows' ? 'h-full w-full' : 'hidden'}>
          <WorkflowStudio
            apiKey={apiKey}
            isHeaderVisible={isHeaderVisible}
            onToggleHeader={setIsHeaderVisible}
          />
        </div>
        <div className={activeTab === 'agents' ? 'h-full w-full' : 'hidden'}>
          <AgentStudio
            apiKey={apiKey}
            isHeaderVisible={isHeaderVisible}
            onToggleHeader={setIsHeaderVisible}
          />
        </div>
        <div className={activeTab === 'design-agent' ? 'h-full w-full' : 'hidden'}>
          {activeTab === 'design-agent' && (
            <DesignAgentStudio
              apiKey={apiKey}
              isHeaderVisible={isHeaderVisible}
              onToggleHeader={setIsHeaderVisible}
            />
          )}
        </div>
        <div className={activeTab === 'apps' ? 'h-full w-full' : 'hidden'}>
          {activeMiniAppId ? (
            <MiniAppHost
              miniAppId={activeMiniAppId}
              apiKey={apiKey}
              onClose={() => setActiveMiniAppId(null)}
            />
          ) : (
            <AppsStudio
              apiKey={apiKey}
              integratedModules={integratedModules}
              onOpenIntegrated={(id) => setActiveMiniAppId(id)}
            />
          )}
        </div>
        <div className={activeTab === 'ai-influencer' ? 'h-full w-full' : 'hidden'}>
          <AiInfluencerStudio apiKey={apiKey} />
        </div>
        <div className={activeTab === 'mcp-cli' ? 'h-full w-full' : 'hidden'}>
          {activeTab === 'mcp-cli' && <McpCliStudio />}
        </div>
      </div>

      {notifications.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none"
          style={{ maxWidth: '360px' }}
        >
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="pointer-events-auto flex items-start gap-3 bg-[#0e0e10] border rounded-xl px-4 py-3 shadow-2xl shadow-black/60"
              style={{
                borderColor:
                  notif.type === 'success'
                    ? 'rgba(34,211,238,0.35)'
                    : 'rgba(239,68,68,0.35)',
                borderLeftWidth: '3px',
                borderLeftColor: notif.type === 'success' ? '#22d3ee' : '#ef4444',
                animation: 'slideInRight 280ms cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >
              <div
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                style={{
                  background:
                    notif.type === 'success'
                      ? 'rgba(34,211,238,0.12)'
                      : 'rgba(239,68,68,0.12)',
                }}
              >
                {notif.type === 'success' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3">
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-white/90 leading-tight">
                  {notif.label}
                  <span className="font-normal text-white/50">
                    {notif.type === 'success' ? ' · Generation complete' : ' · Generation failed'}
                  </span>
                </p>
                {notif.type === 'error' && notif.message && (
                  <p
                    className="text-[11px] text-red-400/80 mt-0.5 leading-snug truncate"
                    title={notif.message}
                  >
                    {notif.message}
                  </p>
                )}
                {notif.type === 'success' && (
                  <button
                    onClick={() => {
                      handleTabChange(notif.tabId);
                      dismissNotification(notif.id);
                    }}
                    className="mt-1.5 text-[11px] font-bold text-[#22d3ee] hover:underline"
                  >
                    Open →
                  </button>
                )}
              </div>
              <button
                onClick={() => dismissNotification(notif.id)}
                className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors text-lg leading-none mt-0.5"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-1">Settings</h2>
            <p className="text-white/40 text-[13px] mb-6">
              {DYNAXIS_PRODUCT.name} — API configuration and account preferences.
            </p>

            <div className="space-y-4 mb-6">
              <div className="bg-white/5 border border-white/[0.03] rounded-md p-4">
                <label className="block text-xs font-bold text-white/30 mb-2">
                  Active {DYNAXIS_PRODUCT.providers.muapi.name} API Key
                </label>
                <div className="text-[13px] font-mono text-white/80">
                  {apiKey.slice(0, 8)}••••••••••••••••
                </div>
              </div>

              <div className="bg-white/5 border border-white/[0.03] rounded-md p-4">
                <label className="block text-xs font-bold text-white/30 mb-2">Project</label>
                {platformStatus && !platformStatus.ok ? (
                  <p className="text-[12px] text-amber-400/80 leading-relaxed">
                    Platform persistence unavailable. Set DATABASE_URL and run{' '}
                    <span className="font-mono text-[11px]">npm run db:migrate</span> for Projects,
                    Assets, and Generation History.
                  </p>
                ) : (
                  <>
                    {projects.length > 0 && (
                      <select
                        value={activeProjectId || ''}
                        onChange={(e) => handleProjectSelect(e.target.value)}
                        className="w-full mb-3 h-9 rounded-md bg-black/40 border border-white/10 px-3 text-[12px] text-white/90"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.isDefault ? ' (default)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="New project name"
                        className="flex-1 h-9 rounded-md bg-black/40 border border-white/10 px-3 text-[12px] text-white/90 placeholder:text-white/25"
                      />
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        className="h-9 px-3 rounded-md bg-[#22d3ee]/15 text-[#22d3ee] text-[11px] font-bold hover:bg-[#22d3ee]/25"
                      >
                        Create
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleImportLocalHistory}
                      className="mt-3 text-[11px] font-semibold text-white/45 hover:text-[#22d3ee]"
                    >
                      Import local studio history (keeps hg_* keys)
                    </button>
                    {historyImportNote && (
                      <p className="mt-2 text-[11px] text-white/40 leading-relaxed">
                        {historyImportNote}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="bg-white/5 border border-white/[0.03] rounded-md p-4">
                <label className="block text-xs font-bold text-white/30 mb-2">About</label>
                <p className="text-[12px] text-white/50 leading-relaxed">
                  {DYNAXIS_PRODUCT.description}
                </p>
                <p className="text-[11px] text-white/30 mt-3 leading-relaxed">
                  Based on{' '}
                  <a
                    href={DYNAXIS_PRODUCT.attribution.upstreamRepo}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white/45 hover:text-[#22d3ee] underline-offset-2 hover:underline"
                  >
                    {DYNAXIS_PRODUCT.attribution.basedOn}
                  </a>{' '}
                  ({DYNAXIS_PRODUCT.attribution.license}). Generation powered by{' '}
                  {DYNAXIS_PRODUCT.providers.muapi.name}.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleKeyChange}
                className="flex-1 h-10 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-all"
              >
                Change Key
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 h-10 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold transition-all border border-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
