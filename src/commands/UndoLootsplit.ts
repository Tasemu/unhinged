import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Undo a lootsplit and remove the appropriate silver from all participants',
	requiredUserPermissions: [PermissionFlagsBits.Administrator]
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
					name: 'lootsplitid',
					description: 'The id for the lootsplit to undo',
					type: ApplicationCommandOptionType.String,
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
		const lootsplitId = interaction.options.getString('lootsplitid', true);

		this.container.logger.info(`Undoing lootsplit for loot-split with ID ${lootsplitId}`);

		// Get lootsplit session
		const session = await prisma.lootSplitSession.findUnique({
			where: { id: lootsplitId }
		});

		// Get configuration
		const configuration = await prisma.configuration.findUnique({
			where: { guildId: interaction.guild.id }
		});

		// If configuration does not exist, return error
		if (!configuration || !configuration.lootSplitPercentModifier) {
			this.container.logger.info(`No configuration found for guild ${interaction.guild.id}`);
			return interaction.reply({
				content: `No configuration found for guild ${interaction.guild.id}`,
				flags: [MessageFlags.Ephemeral]
			});
		}

		// If session does not exist, return error
		if (!session) {
			this.container.logger.info(`No loot-split found with ID ${lootsplitId}`);
			return interaction.reply({
				content: `No loot-split found with ID ${lootsplitId}`,
				flags: [MessageFlags.Ephemeral]
			});
		}

		const { silver, participants, donated, creatorId, approved } = session;

		// If session had not been approved, return error
		if (!approved) {
			this.container.logger.info(`Loot-split with ID ${lootsplitId} has not been approved`);
			return interaction.reply({
				content: `Loot-split with ID ${lootsplitId} has not been approved`,
				flags: [MessageFlags.Ephemeral]
			});
		}

		// If no participants, return error
		if (!participants) {
			this.container.logger.info(`No participants found for loot-split with ID ${lootsplitId}`);
			return interaction.reply({
				content: `No participants found for loot-split with ID ${lootsplitId}`,
				flags: [MessageFlags.Ephemeral]
			});
		}

		try {
			const participantIds = participants.split(',');

			const silverForGuild = Math.floor(silver * configuration.lootSplitPercentModifier);
			const individualShare = silverForGuild / participantIds.length + donated / participantIds.length;

			// Process payments
			await prisma.$transaction([
				prisma.lootSplitSession.update({
					where: { id: lootsplitId },
					data: { approved: false }
				}),
				...participantIds.map((userId: string) =>
					prisma.payoutAccount.update({
						where: { userId },
						data: { balance: { decrement: individualShare } }
					})
				)
			]);

			// Send initial response
			return interaction.reply({
				content: `Undoing lootsplit for loot-split with ID ${lootsplitId} and created by <@${creatorId}>`,
				flags: [MessageFlags.Ephemeral]
			});
		} catch (error) {
			this.container.logger.error(error);
			return interaction.reply({
				content: 'An error occurred while processing the lootsplit',
				flags: [MessageFlags.Ephemeral]
			});
		}
	}
}
