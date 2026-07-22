/**
 * Character conversation service — persona chat (not Agent Studio).
 */

import { z } from 'zod';
import { getPlatformStore } from '../db/store.js';
import {
  buildCharacterSystemPrompt,
  getCharacter,
  getCharacterRevision,
} from './characters.js';
import { executeLlmChat, mockLlmChat } from '../providers/llm.js';
import { DEFAULT_CHARACTER_LLM_MODEL } from '../types.js';

export const startConversationSchema = z.object({
  characterId: z.string().uuid(),
  projectId: z.string().uuid().optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  model: z.string().max(200).optional().nullable(),
  includeGreeting: z.boolean().optional().default(true),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(20000),
  model: z.string().max(200).optional().nullable(),
});

function notFound(code, message) {
  const err = new Error(message);
  err.status = 404;
  err.code = code;
  return err;
}

/**
 * @param {string} ownerRef
 * @param {object} input
 * @param {{ apiKey?: string, llmExecutor?: Function }} [opts]
 */
export async function startCharacterConversation(ownerRef, input, opts = {}) {
  const data = startConversationSchema.parse(input);
  const store = await getPlatformStore();
  const character = await getCharacter(ownerRef, data.characterId);
  if (!character) throw notFound('CHARACTER_NOT_FOUND', 'Character not found');

  const revisionId = character.currentRevisionId || null;
  const conversation = await store.createCharacterConversation({
    ownerRef,
    characterId: character.id,
    characterRevisionId: revisionId,
    projectId: data.projectId ?? null,
    title: data.title || `Chat with ${character.name}`,
    model: data.model || DEFAULT_CHARACTER_LLM_MODEL,
    metadata: {
      continuity: 'reference-based',
      greetingIncluded: Boolean(data.includeGreeting),
    },
  });

  const messages = [];
  if (data.includeGreeting && character.greeting) {
    const greetingMsg = await store.createCharacterMessage({
      conversationId: conversation.id,
      ownerRef,
      role: 'assistant',
      content: character.greeting,
      model: null,
      characterRevisionId: revisionId,
      metadata: { kind: 'greeting' },
    });
    messages.push(greetingMsg);
  }

  return { conversation, messages, character };
}

/**
 * @param {string} ownerRef
 * @param {string} conversationId
 * @param {object} input
 * @param {{ apiKey?: string, llmExecutor?: Function }} [opts]
 */
export async function sendCharacterMessage(ownerRef, conversationId, input, opts = {}) {
  const data = sendMessageSchema.parse(input);
  const store = await getPlatformStore();
  const conversation = await store.getCharacterConversation(ownerRef, conversationId);
  if (!conversation) throw notFound('CONVERSATION_NOT_FOUND', 'Conversation not found');

  const character = await getCharacter(ownerRef, conversation.characterId);
  if (!character) throw notFound('CHARACTER_NOT_FOUND', 'Character not found');

  const revision = conversation.characterRevisionId
    ? await getCharacterRevision(ownerRef, conversation.characterRevisionId)
    : null;
  const systemPrompt = buildCharacterSystemPrompt(character, revision);
  const model = data.model || conversation.model || DEFAULT_CHARACTER_LLM_MODEL;

  const userMessage = await store.createCharacterMessage({
    conversationId,
    ownerRef,
    role: 'user',
    content: data.content,
    model: null,
    characterRevisionId: conversation.characterRevisionId,
  });

  const history = await store.listCharacterMessages(conversationId);
  const llmExecutor =
    opts.llmExecutor ||
    (opts.apiKey
      ? (req) => executeLlmChat(opts.apiKey, req)
      : (req) => Promise.resolve(mockLlmChat(req)));

  let llmResult;
  try {
    llmResult = await llmExecutor({
      prompt: data.content,
      systemPrompt,
      model,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err) {
    await store.createCharacterMessage({
      conversationId,
      ownerRef,
      role: 'assistant',
      content: 'I am having trouble responding right now. Please try again.',
      model,
      characterRevisionId: conversation.characterRevisionId,
      metadata: {
        error: true,
        code: err.code || 'LLM_FAILED',
      },
    });
    throw err;
  }

  const assistantMessage = await store.createCharacterMessage({
    conversationId,
    ownerRef,
    role: 'assistant',
    content: llmResult.reply,
    model: llmResult.model || model,
    characterRevisionId: conversation.characterRevisionId,
    metadata: {
      provider: llmResult.provider,
      requestId: llmResult.raw?.request_id || null,
    },
  });

  await store.updateCharacterConversation(ownerRef, conversationId, {
    model,
    metadata: {
      ...(conversation.metadata || {}),
      lastModel: llmResult.model || model,
    },
  });

  return {
    conversation: await store.getCharacterConversation(ownerRef, conversationId),
    userMessage,
    assistantMessage,
    systemPromptRevisionId: conversation.characterRevisionId,
  };
}

export async function listCharacterConversations(ownerRef, opts = {}) {
  const store = await getPlatformStore();
  return store.listCharacterConversations(ownerRef, opts);
}

export async function getCharacterConversation(ownerRef, id) {
  const store = await getPlatformStore();
  const conversation = await store.getCharacterConversation(ownerRef, id);
  if (!conversation) return null;
  const messages = await store.listCharacterMessages(id);
  return { conversation, messages };
}
