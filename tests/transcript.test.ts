import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  formatTimestamp,
  renderTranscript,
  type TranscriptMessage,
  type TranscriptMeta,
} from '../src/tickets/transcript.js';

const meta: TranscriptMeta = {
  guildName: 'Test Server',
  ticketLabel: 'Ticket #0001',
  subject: 'Cannot log in',
  openedBy: 'alice',
  closedBy: 'bob',
  closedAt: new Date('2026-01-31T09:05:00Z'),
  reason: null,
};

function message(overrides: Partial<TranscriptMessage> = {}): TranscriptMessage {
  return {
    authorName: 'alice',
    authorIsBot: false,
    createdAt: new Date('2026-01-31T09:00:00Z'),
    content: 'hello',
    attachments: [],
    embeds: [],
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('escapes every character that is special in HTML', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('formatTimestamp', () => {
  it('formats in UTC to the minute', () => {
    expect(formatTimestamp(new Date('2026-01-31T09:05:59Z'))).toBe('2026-01-31 09:05 UTC');
  });
});

describe('renderTranscript', () => {
  it('includes the ticket details and every message', () => {
    const html = renderTranscript(meta, [
      message({ content: 'first' }),
      message({ authorName: 'bob', content: 'second' }),
    ]);

    expect(html).toContain('<title>Ticket #0001 - Cannot log in</title>');
    expect(html).toContain('<dt>Messages</dt><dd>2</dd>');
    expect(html).toContain('No reason given');
    expect(html.indexOf('first')).toBeLessThan(html.indexOf('second'));
  });

  it('never lets message content inject markup', () => {
    const html = renderTranscript({ ...meta, subject: '<b>bold</b>' }, [
      message({ authorName: '<img src=x>', content: '<script>alert(1)</script>' }),
    ]);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('links attachments only when the URL is http(s)', () => {
    const html = renderTranscript(meta, [
      message({
        attachments: [
          { name: 'log.txt', url: 'https://cdn.example.com/log.txt' },
          { name: 'evil', url: 'javascript:alert(1)' },
        ],
      }),
    ]);

    expect(html).toContain('href="https://cdn.example.com/log.txt"');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('<span class="attachment">evil</span>');
  });

  it('renders embeds and marks bot authors', () => {
    const html = renderTranscript(meta, [
      message({
        authorIsBot: true,
        content: '',
        embeds: [
          { title: 'Welcome', description: 'Hi there', fields: [{ name: 'A', value: 'B' }] },
        ],
      }),
    ]);

    expect(html).toContain('<span class="bot">BOT</span>');
    expect(html).toContain('<strong>Welcome</strong>');
    expect(html).toContain('Hi there');
    expect(html).not.toContain('<div class="content">');
  });

  it('says so when the ticket has no messages', () => {
    expect(renderTranscript(meta, [])).toContain('No messages were sent in this ticket.');
  });
});
