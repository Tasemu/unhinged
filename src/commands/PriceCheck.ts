import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { ApplicationCommandOptionType, ApplicationIntegrationType, AutocompleteInteraction, InteractionContextType, MessageFlags } from 'discord.js';
import { prisma } from '../client';
import { AlbionDataClientCurrentResponse } from '../types';

@ApplyOptions<Command.Options>({
	description: 'Check the price for an item in Albion Online'
})
export class PriceCheck extends Command {
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
					name: 'item',
					description: 'The item to check the price for',
					type: ApplicationCommandOptionType.String,
					required: true,
					autocomplete: true
				},
				{
					name: 'city',
					description: 'The city to check the price in, defaults to Thetford',
					type: ApplicationCommandOptionType.String,
					required: false,
					choices: [
						{ name: 'Thetford', value: 'Thetford' },
						{ name: 'Bridgewatch', value: 'Bridgewatch' },
						{ name: 'Martlock', value: 'Martlock' },
						{ name: 'Lymhurst', value: 'Lymhurst' },
						{ name: 'Fort Sterling', value: 'FortSterling' },
						{ name: 'Caerleon', value: 'Caerleon' },
						{ name: 'Brecilien', value: 'Brecilien' }
					]
				}
			],
			integrationTypes,
			contexts
		});
	}

	// Chat Input (slash) command
	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (!interaction.guild) return interaction.reply('This command only works in servers!');

		const itemId = interaction.options.getString('item', true);
		const city = interaction.options.getString('city') ?? 'Thetford';

		try {
			// Fetch item details from database
			const dbItem = await prisma.albionItem.findUnique({
				where: { itemId: itemId }
			});

			// Fetch prices from Albion API
			const apiResponse = await fetch(`https://west.albion-online-data.com/api/v2/stats/prices/${itemId}?locations=${city}`);

			if (!apiResponse.ok) throw new Error('Failed to fetch prices');

			const apiData = (await apiResponse.json()) as AlbionDataClientCurrentResponse;

			// Get item name and details
			const itemDetails = dbItem ? `${dbItem.name} (T${dbItem.tier}.${dbItem.enchantment})` : 'Unknown Item';

			const itemLines = apiData.map((market) => {
				const quality = market.quality;
				const sellPriceMin = market.sell_price_min;
				const sellPriceMax = market.sell_price_max;

				let qualityString = '';
				switch (quality) {
					case 1:
						qualityString = 'Normal';
						break;
					case 2:
						qualityString = 'Good';
						break;
					case 3:
						qualityString = 'Outstanding';
						break;
					case 4:
						qualityString = 'Excellent';
						break;
					case 5:
						qualityString = 'Masterpiece';
						break;
				}

				return `**${qualityString}:** ${sellPriceMin.toLocaleString()} - ${sellPriceMax.toLocaleString()} silver`;
			});

			return interaction.reply({
				content: [`**Price Check Request for item: ${itemDetails}**`, `**City: **: ${city}`, ...itemLines].join('\n'),
				flags: [MessageFlags.Ephemeral]
			});
		} catch (error) {
			this.container.logger.error('Regear command failed:', error);
			return interaction.reply({
				content: 'Failed to fetch price data. Please try again later.',
				flags: [MessageFlags.Ephemeral]
			});
		}
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		const focusedOption = interaction.options.getFocused(true);
		const input = focusedOption.value.trim();

		// Enhanced pattern to handle various input formats
		const pattern = /^(?:(\d+)(?:\.(\d+))?)?\s*(?:(\d+)(?:\.(\d+))?)?\s*(.*)/i;
		const [, tierStr1, enchantStr1, tierStr2, enchantStr2, searchTerm] = input.match(pattern) || [];

		// Use the last found tier/enchantment pair
		const tierStr = tierStr2 || tierStr1;
		const enchantStr = enchantStr2 || enchantStr1;

		// Convert to numbers with validation
		const tier = tierStr ? Math.min(Math.max(parseInt(tierStr, 10), 1), 8) : undefined;
		const enchantment = enchantStr ? Math.min(Math.max(parseInt(enchantStr, 10), 0), 4) : undefined;

		// Build Prisma filters
		const filters = [];

		if (searchTerm) {
			filters.push({
				OR: [{ name: { contains: searchTerm } }, { itemId: { contains: searchTerm } }]
			});
		}

		if (tier && !isNaN(tier)) {
			filters.push({ tier });
		}

		if (enchantment && !isNaN(enchantment)) {
			filters.push({ enchantment });
		}

		try {
			const items = await prisma.albionItem.findMany({
				where: { AND: filters },
				orderBy: [{ tier: 'asc' }, { enchantment: 'desc' }, { name: 'asc' }],
				take: 25
			});

			const choices = items.map((item) => ({
				name: `${item.name} (T${item.tier}.${item.enchantment})`,
				value: item.itemId
			}));

			return interaction.respond(choices);
		} catch (error) {
			this.container.logger.error('Autocomplete error:', error);
			return interaction.respond([]);
		}
	}
}
