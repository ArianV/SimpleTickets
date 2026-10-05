import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface GuildSettings {
  categoryId: string;
  supportRoleId: string;
  logChannelId: string;
  maxOpenTickets: number;
}

export interface Ticket {
  channelId: string;
  guildId: string;
  number: number;
  openerId: string;
  subject: string;
  claimedBy: string | null;
  createdAt: number;
  // true while a close is running, so two people can't close the same ticket at once
  closing: boolean;
}

export type NewTicket = Omit<Ticket, 'claimedBy' | 'closing'>;

interface GuildRecord {
  settings: GuildSettings | null;
  ticketCounter: number;
}

interface StoreData {
  version: number;
  guilds: Record<string, GuildRecord>;
  // open tickets only, keyed by channel id
  tickets: Record<string, Ticket>;
}

const SCHEMA_VERSION = 1;

function emptyData(): StoreData {
  return { version: SCHEMA_VERSION, guilds: {}, tickets: {} };
}

function readData(filePath: string): StoreData {
  if (!existsSync(filePath)) return emptyData();

  let data: StoreData;
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8')) as StoreData;
  } catch (error) {
    // don't start with a broken file, we'd overwrite data that might be fixable
    throw new Error(`Could not read ticket data from ${filePath}. Fix or remove the file.`, {
      cause: error,
    });
  }
  if (data.version !== SCHEMA_VERSION) {
    throw new Error(`${filePath} uses data version ${data.version}, expected ${SCHEMA_VERSION}.`);
  }

  // if we restarted in the middle of a close it never finished, so it's still open
  for (const ticket of Object.values(data.tickets)) ticket.closing = false;
  return data;
}

// Everything lives in memory and gets written to a json file on every change.
// Getters return copies so nothing outside can mess with the stored objects.
export class TicketStore {
  private readonly filePath: string | null;
  private readonly data: StoreData;

  // pass null to keep it all in memory (used by the tests)
  constructor(filePath: string | null) {
    this.filePath = filePath;
    this.data = filePath === null ? emptyData() : readData(filePath);
  }

  getSettings(guildId: string): GuildSettings | undefined {
    const settings = this.data.guilds[guildId]?.settings;
    return settings ? { ...settings } : undefined;
  }

  saveSettings(guildId: string, settings: GuildSettings): void {
    const ticketCounter = this.data.guilds[guildId]?.ticketCounter ?? 0;
    this.data.guilds[guildId] = { settings: { ...settings }, ticketCounter };
    this.persist();
  }

  nextTicketNumber(guildId: string): number {
    const record = (this.data.guilds[guildId] ??= { settings: null, ticketCounter: 0 });
    record.ticketCounter += 1;
    this.persist();
    return record.ticketCounter;
  }

  addTicket(ticket: NewTicket): Ticket {
    const created: Ticket = { ...ticket, claimedBy: null, closing: false };
    this.data.tickets[created.channelId] = created;
    this.persist();
    return { ...created };
  }

  getTicket(channelId: string): Ticket | undefined {
    const ticket = this.data.tickets[channelId];
    return ticket ? { ...ticket } : undefined;
  }

  openTicketsFor(guildId: string, openerId: string): Ticket[] {
    return Object.values(this.data.tickets)
      .filter((ticket) => ticket.guildId === guildId && ticket.openerId === openerId)
      .map((ticket) => ({ ...ticket }));
  }

  claim(channelId: string, staffId: string): boolean {
    const ticket = this.data.tickets[channelId];
    if (!ticket || ticket.claimedBy !== null) return false;
    ticket.claimedBy = staffId;
    this.persist();
    return true;
  }

  beginClose(channelId: string): boolean {
    const ticket = this.data.tickets[channelId];
    if (!ticket || ticket.closing) return false;
    ticket.closing = true;
    return true;
  }

  abortClose(channelId: string): void {
    const ticket = this.data.tickets[channelId];
    if (ticket) ticket.closing = false;
  }

  removeTicket(channelId: string): Ticket | undefined {
    const ticket = this.data.tickets[channelId];
    if (!ticket) return undefined;
    delete this.data.tickets[channelId];
    this.persist();
    return ticket;
  }

  private persist(): void {
    if (this.filePath === null) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    // write to a temp file then rename, so a crash mid-write can't corrupt the real one
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(this.data, null, 2));
    renameSync(temporaryPath, this.filePath);
  }
}
