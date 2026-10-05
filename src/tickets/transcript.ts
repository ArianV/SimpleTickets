export interface TranscriptEmbed {
  title: string | null;
  description: string | null;
  fields: { name: string; value: string }[];
}

export interface TranscriptMessage {
  authorName: string;
  authorIsBot: boolean;
  createdAt: Date;
  content: string;
  attachments: { name: string; url: string }[];
  embeds: TranscriptEmbed[];
}

export interface TranscriptMeta {
  guildName: string;
  ticketLabel: string;
  subject: string;
  openedBy: string;
  closedBy: string;
  closedAt: Date;
  reason: string | null;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

// always UTC so the transcript reads the same for everyone
export function formatTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

const STYLES = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #1e1f22; color: #dbdee1; font: 15px/1.45 system-ui, sans-serif; }
  header { padding: 24px 32px; background: #2b2d31; border-bottom: 3px solid #e93020; }
  h1 { margin: 0 0 12px; font-size: 20px; color: #fff; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; }
  dt { color: #949ba4; }
  dd { margin: 0; }
  main { padding: 16px 32px 48px; }
  .message { padding: 8px 0; border-bottom: 1px solid #2b2d31; }
  .author { font-weight: 600; color: #fff; }
  .bot { margin-left: 6px; padding: 1px 5px; border-radius: 3px; background: #5865f2; color: #fff; font-size: 11px; }
  time { margin-left: 8px; color: #949ba4; font-size: 12px; }
  .content { white-space: pre-wrap; overflow-wrap: anywhere; }
  .embed { margin-top: 6px; padding: 8px 12px; border-left: 3px solid #e93020; background: #2b2d31; border-radius: 3px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .embed strong { display: block; color: #fff; }
  .attachment { display: block; margin-top: 4px; color: #00a8fc; }
  .empty { color: #949ba4; }
`;

function renderEmbed(embed: TranscriptEmbed): string {
  const parts: string[] = [];
  if (embed.title) parts.push(`<strong>${escapeHtml(embed.title)}</strong>`);
  if (embed.description) parts.push(escapeHtml(embed.description));
  for (const field of embed.fields) {
    parts.push(`<strong>${escapeHtml(field.name)}</strong>${escapeHtml(field.value)}`);
  }
  return parts.length > 0 ? `<div class="embed">${parts.join('\n')}</div>` : '';
}

function renderAttachment(attachment: { name: string; url: string }): string {
  const name = escapeHtml(attachment.name);
  // only link real web urls, anything else is just shown as text
  if (!/^https?:\/\//i.test(attachment.url)) return `<span class="attachment">${name}</span>`;
  return `<a class="attachment" href="${escapeHtml(attachment.url)}" rel="noopener noreferrer">${name}</a>`;
}

function renderMessage(message: TranscriptMessage): string {
  const badge = message.authorIsBot ? '<span class="bot">BOT</span>' : '';
  const content = message.content
    ? `<div class="content">${escapeHtml(message.content)}</div>`
    : '';
  return [
    '<article class="message">',
    `<span class="author">${escapeHtml(message.authorName)}</span>${badge}`,
    `<time datetime="${message.createdAt.toISOString()}">${formatTimestamp(message.createdAt)}</time>`,
    content,
    ...message.embeds.map(renderEmbed),
    ...message.attachments.map(renderAttachment),
    '</article>',
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderTranscript(
  meta: TranscriptMeta,
  messages: readonly TranscriptMessage[],
): string {
  const title = `${meta.ticketLabel} - ${meta.subject}`;
  const details: [string, string][] = [
    ['Server', meta.guildName],
    ['Opened by', meta.openedBy],
    ['Closed by', meta.closedBy],
    ['Closed at', formatTimestamp(meta.closedAt)],
    ['Reason', meta.reason ?? 'No reason given'],
    ['Messages', String(messages.length)],
  ];
  const body =
    messages.length > 0
      ? messages.map(renderMessage).join('\n')
      : '<p class="empty">No messages were sent in this ticket.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
<header>
<h1>${escapeHtml(title)}</h1>
<dl>
${details.map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`).join('\n')}
</dl>
</header>
<main>
${body}
</main>
</body>
</html>
`;
}
