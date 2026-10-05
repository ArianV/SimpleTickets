import { Client, Events, GatewayIntentBits, OAuth2Scopes } from 'discord.js';
import type { AppContext } from './context.js';
import { loadEnvOrExit } from './env.js';
import { handleInteraction } from './interactions/router.js';
import { createLogger } from './logger.js';
import { BOT_PERMISSIONS } from './tickets/permissions.js';
import { TicketService } from './tickets/service.js';
import { TicketStore } from './tickets/store.js';

const env = loadEnvOrExit();
const logger = createLogger(env.logLevel);
const store = new TicketStore(env.dataFile);
const ctx: AppContext = { store, logger, tickets: new TicketService(store, logger) };

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  allowedMentions: { parse: [] },
  rest: {
    // channel renames are limited to 2 per 10 min. without this discord.js just waits
    // for the limit to reset and /ticket rename looks frozen
    rejectOnRateLimit: (request) => request.method === 'PATCH' && request.route === '/channels/:id',
  },
});

client.once(Events.ClientReady, (readyClient) => {
  logger.info(
    `Logged in as ${readyClient.user.tag}, serving ${readyClient.guilds.cache.size} server(s)`,
  );
  const invite = readyClient.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: BOT_PERMISSIONS,
  });
  logger.info(`Invite link: ${invite}`);
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction, ctx);
});

client.on(Events.ChannelDelete, (channel) => {
  // someone deleted the channel by hand instead of closing the ticket
  if (store.removeTicket(channel.id)) {
    logger.info(`Ticket channel ${channel.id} was deleted; ticket removed`);
  }
});

client.on(Events.Error, (error) => logger.error('Discord client error', error));
process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', reason));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info(`Received ${signal}, shutting down`);
    void client.destroy().finally(() => process.exit(0));
  });
}

try {
  await client.login(env.token);
} catch (error) {
  logger.error('Could not log in to Discord. Check DISCORD_TOKEN in your .env file.', error);
  process.exit(1);
}
