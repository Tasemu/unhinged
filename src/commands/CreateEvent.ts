import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	InteractionContextType,
	MessageFlags
} from 'discord.js';
import { prisma } from '../client';
import moment from 'moment-timezone';

@ApplyOptions<Command.Options>({
	description: 'Create a new event for group content'
})
export class CreateEventCommand extends Command {
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
					name: 'name',
					description: 'The name for the composition',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'date',
					description: 'Event date in UTC (YYYY-MM-DD)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'time',
					description: 'Event time in UTC (HH:MM)',
					type: ApplicationCommandOptionType.String,
					required: true
				},
				{
					name: 'composition',
					description: 'The name of the composition to use',
					type: ApplicationCommandOptionType.String,
					required: true,
					autocomplete: true
				}
			],
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		const name = interaction.options.getString('name', true);
		const dateInput = interaction.options.getString('date', true);
		const timeInput = interaction.options.getString('time', true);

		// Parse as UTC using moment
		const datetimeString = `${dateInput} ${timeInput}`;
		const eventMoment = moment.tz(
			datetimeString,
			'YYYY-MM-DD HH:mm',
			'UTC' // Force UTC timezone
		);

		// Validate input
		if (!eventMoment.isValid()) {
			return interaction.reply({
				content: '❌ Invalid date/time format! Use `YYYY-MM-DD` and `HH:MM` in UTC',
				ephemeral: true
			});
		}

		// Check if in future
		if (eventMoment.isBefore(moment().tz('UTC'))) {
			return interaction.reply({
				content: '❌ Event must be in the future (UTC time)!',
				ephemeral: true
			});
		}

		// Convert to Date object (UTC)
		const eventDate = eventMoment.toDate();

		const compositionId = interaction.options.getString('composition', true);

		const newEvent = await prisma.event.create({
			data: {
				guildId: interaction.guild.id,
				userId: interaction.user.id,
				name: name,
				date: eventDate,
				compositionId: compositionId
			},
			include: {
				composition: true
			}
		});

		if (!newEvent) {
			return interaction.reply({
				content: '❌ An error occurred while creating the event.',
				flags: MessageFlags.Ephemeral
			});
		}

		// Build the embed
		const eventEmbed = new EmbedBuilder()
			.setColor(0x0099ff)
			.setTitle(newEvent.name)
			.setDescription(`**Event Details**`)
			.addFields(
				{
					name: '📅 Date',
					value: [`\`${eventMoment.format('YYYY-MM-DD HH:mm [UTC]')}\``, `(<t:${Math.floor(eventDate.getTime() / 1000)}:R>)`].join('\n'),
					inline: false
				},
				{ name: '🛠️ Composition', value: newEvent.composition.name, inline: false },
				{ name: '👥 Participants', value: '', inline: false }
			)
			.setFooter({ text: `Event ID: ${newEvent.id}` });

		const rolesArray = newEvent.composition.roles.split(',').map((role) => role.trim());
		// Add role slots
		rolesArray.forEach((role) => {
			eventEmbed.addFields({
				name: `⬜ ${role}`,
				value: ``,
				inline: false
			});
		});

		// Create action buttons
		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId(`event-signup:${newEvent.id}`).setLabel('Sign Up').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId(`event-leave:${newEvent.id}`).setLabel('Leave Event').setStyle(ButtonStyle.Danger),
			new ButtonBuilder().setCustomId(`event-cancel:${newEvent.id}`).setLabel('Cancel Event').setStyle(ButtonStyle.Secondary),
			new ButtonBuilder().setCustomId(`event-finish:${newEvent.id}`).setLabel('Finish Event').setStyle(ButtonStyle.Success)
		);

		// In your chatInputRun after sending the reply:
		const replyMessage = await interaction.reply({
			embeds: [eventEmbed],
			components: [buttons],
			fetchReply: true
		});

		// Update the event with message details
		await prisma.event.update({
			where: { id: newEvent.id },
			data: {
				messageId: replyMessage.id,
				channelId: replyMessage.channelId
			}
		});

		return replyMessage;
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		const focusedOption = interaction.options.getFocused(true);
		const input = focusedOption.value.trim();

		try {
			const compositions = await prisma.composition.findMany({
				where: { name: { contains: input }, userId: interaction.user.id },
				take: 25
			});

			const choices = compositions.map((composition) => ({
				name: composition.name,
				value: composition.id
			}));

			return interaction.respond(choices);
		} catch (error) {
			this.container.logger.error('Autocomplete error:', error);
			return interaction.respond([]);
		}
	}
}
