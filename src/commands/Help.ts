// src/commands/Utility/help.ts
import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ApplicationIntegrationType,
	InteractionContextType,
	ApplicationCommandOptionType,
	AutocompleteInteraction,
	EmbedBuilder,
	MessageFlags
} from 'discord.js';

// Add this interface at the top
interface CommandInfo {
	name: string;
	description: string;
	usage: string;
}

// Command categories
const COMMAND_CATEGORIES: {
	[key: string]: {
		name: string;
		commands: CommandInfo[];
	};
} = {
	ADMIN: {
		name: '👑 Admin commands',
		commands: [
			{
				name: 'Purge Accounts',
				description: 'Purge all payout accounts for users no longer in the guild',
				usage: '`/purgeaccounts`'
			},
			{
				name: 'Set Buyback Modifier',
				description: 'Set the buyback modifier percentage for member buybacks',
				usage: '`/setbuybackmodifier 0.7`'
			},
			{
				name: 'Set Loot Split Modifier',
				description: 'Set the loot split modifier percentage for member loot splits',
				usage: '`/setlootsplitmodifier 0.7`'
			},
			{
				name: 'Set Accountant Role',
				description: 'Set the role required for user to be able to approve loot splits and buybacks, withdrawals and deposits',
				usage: '`/setaccountantrole @Accountant`'
			},
			{
				name: 'Set member role',
				description: 'Set the role for a guild member',
				usage: '`/setmemberrole @Member`'
			},
			{
				name: 'Set recrutier role',
				description: 'Set the role for a guild recruiter',
				usage: '`/setrecrutierrole @Reqruiter`'
			},
			{
				name: 'Set trial role',
				description: 'Set the role for a guild trial member',
				usage: '`/settrialrole @Trial`'
			},
			{
				name: 'Set Recruiter Channel',
				description: 'Set the channel for recruiter messages',
				usage: '`/setrecruiterchannel #recruiter`'
			},
			{
				name: 'Undo Loot Split',
				description: 'Undo a lootsplit and remove the appropriate silver from all participants',
				usage: '`/undolootsplit <lootsplitid>`'
			}
		]
	},
	OFFICER: {
		name: '📋 Officer commands',
		commands: [
			{
				name: 'Create Buyback',
				description: 'Create a new buyback for a member to sell items to the guild',
				usage: '`/buyback <user> <silver> <screenshot>`'
			},
			{
				name: 'Deposit',
				description: `Deposit silver into a member's account`,
				usage: '`/deposit <user> <silver> <reason>`'
			},
			{
				name: 'Withdraw',
				description: `Withdraw silver from a member's account`,
				usage: '`/withdraw <user> <silver> <reason>`'
			},
			{
				name: 'Full Payout',
				description: 'Create a full payout for a member and set their account to 0',
				usage: '`/payout <user> <reason>'
			},
			{
				name: 'Member balance',
				description: 'Get the current balance of a guild members payout account',
				usage: '`/getmemberbalance <user>`'
			},
			{
				name: 'Trial Status',
				description: 'Get the remaining trial time for a user',
				usage: '`/gettrialstatus <user>`'
			},
			{
				name: 'Statisitics',
				description: 'Get the statistics for a member',
				usage: '`/stats <user>`'
			},
			{
				name: 'Total Balance',
				description: 'Get the total balance of all payout accounts in the guild',
				usage: '`/totalbalance`'
			}
		]
	},
	MEMBER: {
		name: '🧙 Member commands',
		commands: [
			{
				name: 'Create composition',
				description: 'Create a new composition for group events. Roles are separated by commas such as: Tank, Healer, DPS',
				usage: '`/newcomp <name> <Roles>'
			},
			{
				name: 'Delete composition',
				description: 'Delete a composition for group events',
				usage: '`/deletecomp <name>`'
			},
			{
				name: 'List compositions',
				description: 'List all compositions you have created',
				usage: '`/listcomps`'
			},
			{
				name: 'Create event',
				description: 'Create a new event for the guild. Composition is created with `/createcomp` and can be used here',
				usage: '`/createevent <name> <date> <time> <composition>`'
			},
			{
				name: 'Loot Split',
				description: 'Create a new loot split for event participants',
				usage: '`/lootsplit <silver> <donated> <screenshot>'
			},
			{
				name: 'Leaderboard',
				description: 'Get the leaderboard for the top 10 highest balances in the guild',
				usage: '`/leaderboard`'
			},
			{
				name: 'Price Check',
				description: 'Get the current price of an item in Albion Online. The city argument is optional and defaults to Thetford',
				usage: '`/pricecheck <item> <city>`'
			},
			{
				name: 'Regear',
				description: 'Request a regear for a death during a CTA',
				usage: '`/regear <user> <screenshot> <helmet> <body> <boots> <mainweapon> <offhand>`'
			},
			{
				name: 'Balance',
				description: 'Get the current balance of your payout account',
				usage: '`/balance`'
			}
		]
	}
};

@ApplyOptions<Command.Options>({
	description: 'Get help with all bot commands'
})
export class HelpCommand extends Command {
	// Register Chat Input and Context Menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Create shared integration types and contexts
		// These allow the command to be used in guilds and DMs
		const integrationTypes: ApplicationIntegrationType[] = [ApplicationIntegrationType.GuildInstall];
		const contexts: InteractionContextType[] = [InteractionContextType.Guild];

		// Register Chat Input command
		registry.registerChatInputCommand({
			name: this.name,
			description: this.description,
			options: [
				{
					name: 'command',
					description: 'The command to get help for',
					type: ApplicationCommandOptionType.String,
					required: false,
					autocomplete: true
				}
			],
			integrationTypes,
			contexts
		});
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const commandName = interaction.options.getString('command');

		if (commandName) {
			return this.showCommandHelp(interaction, commandName);
		}

		return this.showMainHelp(interaction);
	}

	private async showMainHelp(interaction: Command.ChatInputCommandInteraction) {
		const embed = new EmbedBuilder()
			.setColor(0x0099ff)
			.setTitle('Guild Bot Help')
			.setDescription('Use `/help [command]` for detailed info about a specific command');

		// Add category fields
		Object.values(COMMAND_CATEGORIES).forEach((category) => {
			const commandsList = category.commands.map((cmd) => `**${cmd.name}**\n${cmd.description}`).join('\n\n');

			embed.addFields({
				name: category.name,
				value: commandsList,
				inline: false
			});
		});

		await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
	}

	private async showCommandHelp(interaction: Command.ChatInputCommandInteraction, commandName: string) {
		// Search all categories for the command
		let foundCommand: any = null;
		let categoryName = '';

		Object.entries(COMMAND_CATEGORIES).forEach(([_, category]) => {
			const cmd = category.commands.find((c) => c.name.toLowerCase() === commandName.toLowerCase());
			if (cmd) {
				foundCommand = cmd;
				categoryName = category.name;
			}
		});

		if (!foundCommand) {
			return interaction.reply({
				content: `Command "${commandName}" not found!`,
				ephemeral: true
			});
		}

		const embed = new EmbedBuilder()
			.setColor(0x00ff00)
			.setTitle(foundCommand.name)
			.addFields(
				{ name: 'Description', value: foundCommand.description },
				{ name: 'Usage', value: foundCommand.usage },
				{ name: 'Category', value: categoryName }
			);

		return await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		const focusedValue = interaction.options.getFocused().toLowerCase();

		// Get all command names
		const allCommands = Object.values(COMMAND_CATEGORIES)
			.flatMap((category) => category.commands)
			.map((cmd) => cmd.name);

		// Filter matches
		const filtered = allCommands.filter((name) => name.toLowerCase().includes(focusedValue)).slice(0, 25);

		return interaction.respond(filtered.map((name) => ({ name, value: name })));
	}
}
