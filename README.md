<h1 align="center">
  <img src="https://i.imgur.com/PpQaXUC.png" alt="SimpleTickets"><br>
  SimpleTickets
</h1>

<p align="center">A Discord ticket bot you host yourself.</p>

Members click a button, fill in a short form and get a private channel with your support team. When the ticket is done, the bot saves a transcript and deletes the channel.

Built with TypeScript and discord.js v14.

## What it does

- Ticket panel with a button, posted with one command
- Every ticket gets its own private channel (`ticket-0001`, `ticket-0002`, ...)
- Support can claim tickets, add or remove people and rename the channel
- Closing a ticket saves an HTML transcript to your log channel and DMs a copy to whoever opened it
- Limit on how many tickets one person can have open at once (1 by default)
- Works in more than one server, each with its own settings
- No database to set up, everything is kept in one small JSON file

## Setup

You need [Node.js](https://nodejs.org) 20 or newer and a bot token.

### Getting a bot token

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. Open the **Bot** tab, press **Reset Token** and copy the token.
3. On the same page, turn on **Message Content Intent**. The bot needs it to read messages for the transcripts.

### Windows

1. Download the repo and unzip it somewhere.
2. Run `install.bat`. It installs everything, opens the `.env` file so you can paste your token in, and registers the slash commands.
3. Run `start.bat` whenever you want to start the bot.

### Mac / Linux, or if you'd rather do it by hand

```bash
npm install
cp .env.example .env    # put your token in here
npm run build
npm run deploy          # registers the slash commands
npm start
```

### In Discord

When the bot starts it prints an invite link in the console. Use that to add it to your server, then:

1. Run `/setup` and pick the category tickets should go in, your support role and a log channel. If the bot is missing any permissions it will tell you here.
2. Run `/panel` in the channel where people should open tickets.

That's it.

## Commands

| Command | Who can use it | What it does |
| --- | --- | --- |
| `/setup` | Manage Server | Sets the ticket category, support role and log channel |
| `/panel` | Manage Server | Posts the "Open a ticket" message |
| `/ticket claim` | Support role | Marks you as the one handling the ticket |
| `/ticket add` | Support | Adds someone to the ticket |
| `/ticket remove` | Support | Removes someone you added |
| `/ticket rename` | Support | Renames the ticket channel |
| `/ticket close` | Support, or whoever opened it | Saves the transcript and deletes the channel |

"Support" is anyone with the support role or the Manage Server permission. Claiming is the one exception, you need the actual support role for that.

Each ticket also has Claim and Close buttons that do the same thing as the commands.

## Config

The only thing you have to set in `.env` is the token. The rest is optional.

| Variable | Default | What it's for |
| --- | --- | --- |
| `DISCORD_TOKEN` | | Your bot token |
| `DEV_GUILD_ID` | | Registers the commands to one server only. Handy while developing because they update instantly |
| `DATA_FILE` | `data/tickets.json` | Where settings and open tickets are saved |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |

## Docker

```bash
docker build -t simpletickets .
docker run --rm --env-file .env simpletickets node dist/deploy-commands.js
docker run -d --name simpletickets --env-file .env -v simpletickets-data:/app/data simpletickets
```

## Development

```bash
npm run dev      # runs from source and restarts when you save
npm run check    # typecheck, lint, formatting and tests
```

The code is split up like this:

```
src/
  index.ts            starts the client and hooks up the events
  deploy-commands.ts  registers the slash commands
  commands/           /setup, /panel and /ticket
  interactions/       button and form handlers
  tickets/            the actual ticket logic, storage and transcripts
tests/
```

## Good to know

- Discord only lets a channel be renamed twice every 10 minutes. If you hit that, the bot tells you when you can try again.
- Transcripts keep the last 1000 messages of a ticket.
- Files in a transcript are links to Discord, and those links stop working a while after the channel is deleted. If a file matters, save it before closing.
- The support role only gets pinged on new tickets if the role is mentionable, or the bot has the "Mention @everyone, @here, and All Roles" permission.

## License

[ISC](LICENSE)
