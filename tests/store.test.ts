import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TicketStore, type GuildSettings, type NewTicket } from '../src/tickets/store.js';

const GUILD = '100000000000000001';
const OPENER = '200000000000000001';
const STAFF = '300000000000000001';

const settings: GuildSettings = {
  categoryId: '400000000000000001',
  supportRoleId: '500000000000000001',
  logChannelId: '600000000000000001',
  maxOpenTickets: 1,
};

function newTicket(channelId: string, overrides: Partial<NewTicket> = {}): NewTicket {
  return {
    channelId,
    guildId: GUILD,
    number: 1,
    openerId: OPENER,
    subject: 'Help',
    createdAt: 0,
    ...overrides,
  };
}

describe('TicketStore', () => {
  it('returns undefined for a server that was never set up', () => {
    expect(new TicketStore(null).getSettings(GUILD)).toBeUndefined();
  });

  it('keeps the ticket counter when settings are saved again', () => {
    const store = new TicketStore(null);
    store.saveSettings(GUILD, settings);
    expect(store.nextTicketNumber(GUILD)).toBe(1);
    expect(store.nextTicketNumber(GUILD)).toBe(2);

    store.saveSettings(GUILD, { ...settings, maxOpenTickets: 3 });

    expect(store.getSettings(GUILD)?.maxOpenTickets).toBe(3);
    expect(store.nextTicketNumber(GUILD)).toBe(3);
  });

  it('counts tickets separately for each server', () => {
    const store = new TicketStore(null);
    store.nextTicketNumber(GUILD);
    expect(store.nextTicketNumber('100000000000000002')).toBe(1);
  });

  it('finds open tickets by opener within one server', () => {
    const store = new TicketStore(null);
    store.addTicket(newTicket('1'));
    store.addTicket(newTicket('2', { openerId: 'someone-else' }));
    store.addTicket(newTicket('3', { guildId: 'another-server' }));

    expect(store.openTicketsFor(GUILD, OPENER).map((ticket) => ticket.channelId)).toEqual(['1']);
  });

  it('lets only the first person claim a ticket', () => {
    const store = new TicketStore(null);
    store.addTicket(newTicket('1'));

    expect(store.claim('1', STAFF)).toBe(true);
    expect(store.claim('1', 'another-staff')).toBe(false);
    expect(store.getTicket('1')?.claimedBy).toBe(STAFF);
    expect(store.claim('missing', STAFF)).toBe(false);
  });

  it('lets only one close run at a time, and allows a retry after an aborted close', () => {
    const store = new TicketStore(null);
    store.addTicket(newTicket('1'));

    expect(store.beginClose('1')).toBe(true);
    expect(store.beginClose('1')).toBe(false);

    store.abortClose('1');
    expect(store.beginClose('1')).toBe(true);
  });

  it('forgets a ticket once it is removed', () => {
    const store = new TicketStore(null);
    store.addTicket(newTicket('1'));

    expect(store.removeTicket('1')?.channelId).toBe('1');
    expect(store.getTicket('1')).toBeUndefined();
    expect(store.removeTicket('1')).toBeUndefined();
  });

  it('hands out copies, so callers cannot change stored tickets by accident', () => {
    const store = new TicketStore(null);
    const ticket = store.addTicket(newTicket('1'));
    ticket.subject = 'changed';

    expect(store.getTicket('1')?.subject).toBe('Help');
  });
});

describe('TicketStore persistence', () => {
  let directory: string;
  let file: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'simpletickets-'));
    file = join(directory, 'nested', 'tickets.json');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('restores settings, counters and tickets after a restart', () => {
    const first = new TicketStore(file);
    first.saveSettings(GUILD, settings);
    first.addTicket(newTicket('1', { number: first.nextTicketNumber(GUILD) }));
    first.claim('1', STAFF);

    const second = new TicketStore(file);

    expect(second.getSettings(GUILD)).toEqual(settings);
    expect(second.getTicket('1')).toMatchObject({ number: 1, claimedBy: STAFF });
    expect(second.nextTicketNumber(GUILD)).toBe(2);
  });

  it('reopens a ticket whose close was interrupted by a restart', () => {
    const first = new TicketStore(file);
    first.addTicket(newTicket('1'));
    first.beginClose('1');
    first.claim('1', STAFF); // forces a write while the close is in progress

    expect(new TicketStore(file).beginClose('1')).toBe(true);
  });

  it('refuses to start on a corrupt file instead of overwriting it', () => {
    new TicketStore(file).saveSettings(GUILD, settings);
    writeFileSync(file, '{ not json');

    expect(() => new TicketStore(file)).toThrow(/Could not read ticket data/);
    expect(readFileSync(file, 'utf8')).toBe('{ not json');
  });
});
