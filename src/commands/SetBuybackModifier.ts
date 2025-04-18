import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Set the percent modifier for buybacks',
	requiredUserPermissions: [PermissionFlagsBits.Administrator]
})
export class SetBuybackModifierCommand extends Command {
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
					name: 'modifier',
					description: 'The percent modifier for buybacks, for example 0.7 for 70%',
					type: ApplicationCommandOptionType.Number,
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

		const modifier = interaction.options.getNumber('modifier', true);

		await prisma.configuration.upsert({
			where: { guildId: interaction.guild.id },
			update: { buybackPercentModifier: modifier },
			create: {
				guildId: interaction.guild.id,
				buybackPercentModifier: modifier
			}
		});

		return interaction.reply(`✅ Buyback modifier set to ${modifier}!`);
	}
}
