import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationIntegrationType, InteractionContextType, MessageFlags } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'List all compositions for group content'
})
export class ListCompsCommand extends Command {
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
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		try {
			// Fetch compositions for member
			const compositions = await prisma.composition.findMany({
				where: {
					guildId: interaction.guild.id,
					userId: interaction.user.id
				}
			});

			if (!compositions || compositions.length === 0) {
				return interaction.reply({
					content: '❌ No compositions found for you.',
					flags: MessageFlags.Ephemeral
				});
			}

			// Create a list of compositions
			const compositionList = compositions.map((comp) => `- **${comp.name}**: ${comp.roles}`).join('\n');
			const header = `**Compositions for ${interaction.user.username}**`;

			// Reply with the list of compositions
			return interaction.reply({
				content: `${header}\n${compositionList}`,
				flags: MessageFlags.Ephemeral
			});
		} catch (error) {
			this.container.logger.error('List compositions error:', error);
			return interaction.reply({
				content: '❌ Failed to list compositions! contact an officer (Tasemu)',
				flags: MessageFlags.Ephemeral
			});
		}
	}
}
