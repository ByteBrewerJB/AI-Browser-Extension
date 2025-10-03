import { db } from '@/core/storage/db';
import type { ConversationRecord, MessageRecord, BookmarkRecord } from '@/core/models';

interface ExportedConversation {
  conversation: ConversationRecord;
  messages: MessageRecord[];
  bookmarks: BookmarkRecord[];
}

async function getConversationsWithDetails(conversationIds: string[]): Promise<ExportedConversation[]> {
  const conversations = await db.conversations.where('id').anyOf(conversationIds).toArray();
  const messages = await db.messages.where('conversationId').anyOf(conversationIds).toArray();
  const bookmarks = await db.bookmarks.where('conversationId').anyOf(conversationIds).toArray();

  return conversations.map(conversation => ({
    conversation,
    messages: messages.filter(m => m.conversationId === conversation.id),
    bookmarks: bookmarks.filter(b => b.conversationId === conversation.id),
  }));
}

export async function exportToJSON(conversationIds: string[]): Promise<string> {
  const data = await getConversationsWithDetails(conversationIds);
  return JSON.stringify(data, null, 2);
}

export async function exportToTXT(conversationIds: string[]): Promise<string> {
  const data = await getConversationsWithDetails(conversationIds);
  let txtOutput = '';

  for (const item of data) {
    txtOutput += `Conversation: ${item.conversation.title}\n`;
    txtOutput += `ID: ${item.conversation.id}\n`;
    txtOutput += `Created: ${item.conversation.createdAt}\n`;
    txtOutput += `Updated: ${item.conversation.updatedAt}\n\n`;

    txtOutput += '--- Messages ---\n';
    for (const message of item.messages) {
      txtOutput += `[${message.createdAt}] ${message.role}:\n${message.content}\n\n`;
    }

    if (item.bookmarks.length > 0) {
      txtOutput += '--- Bookmarks ---\n';
      for (const bookmark of item.bookmarks) {
        txtOutput += `[${bookmark.createdAt}] Bookmark ID: ${bookmark.id}\n`;
        if (bookmark.note) {
          txtOutput += `Note: ${bookmark.note}\n`;
        }
        txtOutput += '\n';
      }
    }
    txtOutput += '----------------------------------------\n\n';
  }

  return txtOutput;
}