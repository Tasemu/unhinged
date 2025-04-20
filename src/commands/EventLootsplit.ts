import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	ButtonBuilder,
	ButtonStyle,
	InteractionContextType,
	MessageFlags
} from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Log a loot-split for an event and automatically generate a list of participants'
})
export class EventLootSplitCommand extends Command {
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
					name: 'eventid',
					description: 'E.g. 123456789012345678',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'silver',
					description: 'The total silver to be split',
					type: ApplicationCommandOptionType.Number,
					required: true
				},
				{
					name: 'silverbags',
					description: 'The total silver collected from silver bags',
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

		const eventId = interaction.options.getString('eventid', true);
		const silver = interaction.options.getNumber('silver', true);
		const donated = interaction.options.getNumber('silverbags', true);
		const screenshot = interaction.options.getAttachment('screenshot', true);

		this.container.logger.info(`Loot Split: ${silver} silver, ${donated} donated, ${screenshot.url}`);

		try {
			const event = await prisma.event.findUnique({
				where: { id: eventId },
				include: {
					participants: true
				}
			});

			if (!event) {
				this.container.logger.error('Event not found:', eventId);
				return interaction.reply({
					content: '❌ Event not found.',
					flags: MessageFlags.Ephemeral
				});
			}

			if (event.userId !== interaction.user.id) {
				return interaction.reply({
					content: '❌ Only the creator of this event can create a loot split',
					flags: MessageFlags.Ephemeral
				});
			}

			const parsedParticipants = event.participants.map((p) => p.userId);

			// Create database session
			const session = await prisma.lootSplitSession.create({
				data: {
					guildId: interaction.guild.id,
					silver,
					donated,
					screenshotUrl: screenshot.url,
					creatorId: interaction.user.id,
					participants: parsedParticipants.join(',')
				}
			});

			const header = `Confirm loot split for **${event.name}**`;
			const participantLines = event.participants.map((p) => `- <@${p.userId}>`).join('\n');
			const participantList = `**Participants:**\n${participantLines}`;

			// Create approval buttons
			const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId(`lootsplit-confirm:${session.id}`).setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅')
			);

			return interaction.reply({
				content: `${header}\n${participantList}`,
				components: [approvalRow],
				flags: MessageFlags.Ephemeral
			});
		} catch (error) {
			this.container.logger.error('Loot split error:', error);
			return interaction.reply({
				content: '❌ Failed to create loot split session! contact an officer (Tasemu)',
				flags: MessageFlags.Ephemeral
			});
		}
	}
}
