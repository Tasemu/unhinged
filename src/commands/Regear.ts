import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ApplicationIntegrationType,
	AutocompleteInteraction,
	ButtonBuilder,
	ButtonStyle,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits
} from 'discord.js';
import { prisma } from '../client';

interface AlbionPrice {
	item_id: string;
	city: string;
	sell_price_min: number;
	sell_price_min_date: string;
}

@ApplyOptions<Command.Options>({
	description: 'Log a re-gear for a user',
	requiredUserPermissions: [PermissionFlagsBits.Administrator]
})
export class RegearCommand extends Command {
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
					name: 'user',
					description: 'The user to re-gear',
					type: ApplicationCommandOptionType.User,
					required: true
				},
				{
					name: 'helmet',
					description: 'The helmet to re-gear',
					type: ApplicationCommandOptionType.String,
					required: false,
					autocomplete: true
				},
				{
					name: 'body',
					description: 'The body-armour to re-gear',
					type: ApplicationCommandOptionType.String,
					required: false,
					autocomplete: true
				},
				{
					name: 'boots',
					description: 'The boots to re-gear',
					type: ApplicationCommandOptionType.String,
					required: false,
					autocomplete: true
				},
				{
					name: 'mainweapon',
					description: 'The main weapon to re-gear',
					type: ApplicationCommandOptionType.String,
					required: false,
					autocomplete: true
				},
				{
					name: 'offhand',
					description: 'The off-hand to re-gear',
					type: ApplicationCommandOptionType.String,
					required: false,
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

		// Get the user and gear
		const user = interaction.options.getUser('user', true);
		const items = {
			helmet: interaction.options.getString('helmet', false),
			body: interaction.options.getString('body', false),
			boots: interaction.options.getString('boots', false),
			mainWeapon: interaction.options.getString('mainweapon', false),
			offhand: interaction.options.getString('offhand', false)
		};

		// Get valid item IDs
		const itemIds = Object.values(items).filter(Boolean) as string[];

		try {
			// Fetch item details from database
			const dbItems = await prisma.albionItem.findMany({
				where: { itemId: { in: itemIds } }
			});

			// Fetch prices from Albion API
			const apiResponse = await fetch(
				`https://www.albion-online-data.com/api/v2/stats/prices/${itemIds.join(',')}.json?locations=Thetford&qualities=4`
			);

			if (!apiResponse.ok) throw new Error('Failed to fetch prices');
			const prices: Array<{ item_id: string; sell_price_min: number }> = (await apiResponse.json()) as AlbionPrice[];

			// Create response lines
			const itemLines = await Promise.all(
				itemIds.map(async (itemId) => {
					const dbItem = dbItems.find((i) => i.itemId === itemId);
					const price = prices.find((p) => p.item_id === itemId);

					// Get item name and details
					const itemDetails = dbItem ? `${dbItem.name} (T${dbItem.tier}.${dbItem.enchantment})` : 'Unknown Item';

					const priceInfo = price ? `Price: ${price.sell_price_min.toLocaleString()} silver` : 'Price: Not available';

					return `• ${itemDetails} - ${priceInfo}`;
				})
			);

			// Calculate total cost
			const totalCost = prices.reduce((sum, price) => sum + price.sell_price_min, 0);

			// Create approval buttons
			const approvalRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`regear-approve:${user.id}:${totalCost}`)
					.setLabel('Approve')
					.setStyle(ButtonStyle.Success)
					.setEmoji('✅'),
				new ButtonBuilder()
					.setCustomId(`regear-reject:${user.id}:${totalCost}`)
					.setLabel('Deny')
					.setStyle(ButtonStyle.Secondary)
					.setEmoji('❌')
			);

			return interaction.reply({
				content: [
					`**Regear Request for ${user.displayName}**`,
					...itemLines,
					`\n`,
					`**Total Estimated Cost:** ${totalCost.toLocaleString()} silver`,
					`_Prices from Thetford (Quality: Excellent)_`
				].join('\n'),
				components: [approvalRow]
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
