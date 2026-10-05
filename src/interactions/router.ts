import { MessageFlags, type Interaction, type RepliableInteraction } from 'discord.js';
import { commandsByName } from '../commands/index.js';
import type { AppContext } from '../context.js';
import { UserError } from '../errors.js';
import { handleButton, handleModal } from './components.js';

const GENERIC_ERROR = 'Something went wrong on my end. Please try again in a moment.';

async function reportError(
  interaction: RepliableInteraction,
  error: unknown,
  ctx: AppContext,
): Promise<void> {
  const expected = error instanceof UserError;
  if (!expected) ctx.logger.error(`Interaction ${interaction.id} failed`, error);
  const content = expected ? error.message : GENERIC_ERROR;

  try {
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content });
    } else if (interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch (replyError) {
    // interaction expired or the channel is gone, nothing more we can do
    ctx.logger.debug(`Could not report an error on interaction ${interaction.id}`, replyError);
  }
}

export async function handleInteraction(interaction: Interaction, ctx: AppContext): Promise<void> {
  if (!interaction.isRepliable() || !interaction.inCachedGuild()) return;

  try {
    if (interaction.isChatInputCommand()) {
      await commandsByName.get(interaction.commandName)?.execute(interaction, ctx);
    } else if (interaction.isButton()) {
      await handleButton(interaction, ctx);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction, ctx);
    }
  } catch (error) {
    await reportError(interaction, error, ctx);
  }
}
