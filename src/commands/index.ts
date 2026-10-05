import { panelCommand } from './panel.js';
import { setupCommand } from './setup.js';
import { ticketCommand } from './ticket.js';
import type { Command } from './types.js';

export const commands: readonly Command[] = [setupCommand, panelCommand, ticketCommand];

export const commandsByName: ReadonlyMap<string, Command> = new Map(
  commands.map((command) => [command.data.name, command]),
);
