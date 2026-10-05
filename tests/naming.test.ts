import { describe, expect, it } from 'vitest';
import { UserError } from '../src/errors.js';
import {
  formatTicketNumber,
  renamedChannelName,
  slugify,
  ticketChannelName,
} from '../src/tickets/naming.js';

describe('ticket numbering', () => {
  it('pads numbers to four digits', () => {
    expect(formatTicketNumber(7)).toBe('0007');
    expect(ticketChannelName(42)).toBe('ticket-0042');
  });

  it('does not truncate numbers past 9999', () => {
    expect(formatTicketNumber(12345)).toBe('12345');
  });
});

describe('slugify', () => {
  it('lowercases and replaces anything that is not a letter or number', () => {
    expect(slugify('  Billing Issue #2!  ')).toBe('billing-issue-2');
  });

  it('keeps letters from other alphabets', () => {
    expect(slugify('Проблема с оплатой')).toBe('проблема-с-оплатой');
  });
});

describe('renamedChannelName', () => {
  it('adds the ticket prefix', () => {
    expect(renamedChannelName('Billing')).toBe('ticket-billing');
  });

  it('does not double the prefix', () => {
    expect(renamedChannelName('ticket-billing')).toBe('ticket-billing');
  });

  it('leaves words that merely start with "ticket" alone', () => {
    expect(renamedChannelName('ticketing bug')).toBe('ticket-ticketing-bug');
  });

  it('rejects names with nothing usable in them', () => {
    expect(() => renamedChannelName('!!! ???')).toThrow(UserError);
  });

  it('stays within the 100 character channel name limit', () => {
    const name = renamedChannelName('a'.repeat(300));
    expect(name).toHaveLength(100);
  });
});
