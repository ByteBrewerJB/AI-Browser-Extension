import type { ConversationTableConfig, ConversationTablePreset } from '@/core/models';

import { db } from './db';

const CONVERSATION_TABLE_SETTINGS_ID = 'conversation-table';

function nowIso() {
  return new Date().toISOString();
}

async function getConversationTableRecord() {
  return db.settings.get(CONVERSATION_TABLE_SETTINGS_ID);
}

export async function getConversationTablePresets() {
  const record = await getConversationTableRecord();
  return record?.conversationPresets ?? [];
}

export interface ConversationTablePresetInput {
  name: string;
  config: ConversationTableConfig;
}

export async function createConversationTablePreset(
  input: ConversationTablePresetInput
): Promise<ConversationTablePreset> {
  const existingRecord = await getConversationTableRecord();
  const timestamp = nowIso();

  const preset: ConversationTablePreset = {
    id: crypto.randomUUID(),
    name: input.name,
    config: input.config,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const nextPresets = [...(existingRecord?.conversationPresets ?? []), preset];

  await db.settings.put({
    ...(existingRecord ?? {}),
    id: CONVERSATION_TABLE_SETTINGS_ID,
    conversationPresets: nextPresets,
    updatedAt: timestamp
  });

  return preset;
}

export async function deleteConversationTablePreset(presetId: string) {
  const existingRecord = await getConversationTableRecord();
  if (!existingRecord?.conversationPresets) {
    return;
  }

  const nextPresets = existingRecord.conversationPresets.filter((preset) => preset.id !== presetId);
  const timestamp = nowIso();

  await db.settings.put({
    ...(existingRecord ?? {}),
    id: CONVERSATION_TABLE_SETTINGS_ID,
    conversationPresets: nextPresets,
    updatedAt: timestamp
  });
}
