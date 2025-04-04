import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, InteractionContextType, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../client';

@ApplyOptions<Command.Options>({
	description: 'Set the trial role id for new members',
	requiredUserPermissions: [PermissionFlagsBits.Administrator]
})
export class TrialRoleCommand extends Command {
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
					name: 'role',
					description: 'The role',
					type: ApplicationCommandOptionType.Role,
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

		const role = interaction.options.getRole('role', true);

		await prisma.configuration.upsert({
			where: { guildId: interaction.guild.id },
			update: { trialRoleId: role.id },
			create: {
				guildId: interaction.guild.id,
				trialRoleId: role.id
			}
		});

		return interaction.reply(`✅ Trial role set to ${role.name}!`);
	}
}
