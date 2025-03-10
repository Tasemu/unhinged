import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	InteractionContextType,
	UserSelectMenuBuilder
} from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Log a loot-split for a group of users'
})
export class LootSplitCommand extends Command {
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
					name: 'silver',
					description: 'The total silver to be split',
					type: ApplicationCommandOptionType.Number,
					required: true
				},
				{
					name: 'donated',
					description: 'The total silver donated to the guild from silver bags',
					type: ApplicationCommandOptionType.Number,
					required: true
				},
				{
					name: 'screenshot',
					description: 'A screenshot of the loot',
					type: ApplicationCommandOptionType.Attachment,
					required: true
				}
			],
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		const silver = interaction.options.getNumber('silver', true);
		const donated = interaction.options.getNumber('donated', true);
		const screenshot = interaction.options.getAttachment('screenshot', true);

		this.container.logger.info(`Loot Split: ${silver} silver, ${donated} donated, ${screenshot.url}`);

		// Create database session
		const session = await prisma.lootSplitSession.create({
			data: {
				guildId: interaction.guild.id,
				silver,
				donated,
				screenshotUrl: screenshot.url,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
			}
		});

		// Create user selection menu
		const selectMenu = new UserSelectMenuBuilder()
			.setCustomId(`lootsplit:${session.id}`)
			.setPlaceholder('Select participants')
			.setMinValues(1)
			.setMaxValues(25);

		const actionRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(selectMenu);

		return interaction.reply({
			content: '**Loot Split Setup**\nSelect participants:',
			components: [actionRow],
			ephemeral: true
		});

		// const user = interaction.options.getUser('user', true);

		// const trial = await prisma.trialStart.findUnique({
		// 	where: {
		// 		userId: user.id
		// 	}
		// });

		// if (!trial) {
		// 	return interaction.reply(`<@${user.id}> is not on trial!`);
		// }

		// const trialEnd = new Date(trial.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
		// const now = new Date();
		// const timeRemaining = trialEnd.getTime() - now.getTime();

		// const days = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));
		// const hours = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
		// const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));

		// return interaction.reply(`Trial for <@${user.id}> ends in ${days} days, ${hours} hours, and ${minutes} minutes`);
	}
}
