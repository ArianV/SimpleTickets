import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';
import { loadEnvOrExit } from './env.js';

// Run this once, and again any time a slash command changes.

const env = loadEnvOrExit();
const rest = new REST().setToken(env.token);
const body = commands.map((command) => command.data.toJSON());

const application = (await rest.get(Routes.currentApplication())) as { id: string };

if (env.devGuildId) {
  await rest.put(Routes.applicationGuildCommands(application.id, env.devGuildId), { body });
  console.log(`Registered ${body.length} commands to server ${env.devGuildId}.`);
} else {
  await rest.put(Routes.applicationCommands(application.id), { body });
  console.log(`Registered ${body.length} commands globally. They can take a minute to appear.`);
}
