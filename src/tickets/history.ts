import type { Message, TextChannel } from 'discord.js';
import type { TranscriptMessage } from './transcript.js';

const PAGE_SIZE = 100;

function toTranscriptMessage(message: Message<true>): TranscriptMessage {
  return {
    authorName: message.member?.displayName ?? message.author.displayName,
    authorIsBot: message.author.bot,
    createdAt: message.createdAt,
    content: message.cleanContent,
    attachments: message.attachments.map((attachment) => ({
      name: attachment.name,
      url: attachment.url,
    })),
    embeds: message.embeds.map((embed) => ({
      title: embed.title,
      description: embed.description,
      fields: embed.fields.map((field) => ({ name: field.name, value: field.value })),
    })),
  };
}

// grabs the newest `limit` messages and returns them oldest first
export async function collectMessages(
  channel: TextChannel,
  limit = 1000,
): Promise<TranscriptMessage[]> {
  const newestFirst: Message<true>[] = [];
  let before: string | undefined;

  while (newestFirst.length < limit) {
    const page = await channel.messages.fetch({ limit: PAGE_SIZE, before, cache: false });
    newestFirst.push(...page.values());
    before = page.lastKey();
    if (page.size < PAGE_SIZE) break;
  }

  return newestFirst.slice(0, limit).reverse().map(toTranscriptMessage);
}
