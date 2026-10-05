import { UserError } from '../errors.js';

const CHANNEL_PREFIX = 'ticket-';
const MAX_CHANNEL_NAME_LENGTH = 100;

export function formatTicketNumber(number: number): string {
  return String(number).padStart(4, '0');
}

export function ticketChannelName(number: number): string {
  return `${CHANNEL_PREFIX}${formatTicketNumber(number)}`;
}

export function slugify(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export function renamedChannelName(input: string): string {
  const slug = slugify(input).replace(/^ticket-/, '');
  if (!slug) {
    throw new UserError('That name has no letters or numbers in it. Try something like `billing`.');
  }
  return `${CHANNEL_PREFIX}${slug}`.slice(0, MAX_CHANNEL_NAME_LENGTH).replace(/-+$/, '');
}
