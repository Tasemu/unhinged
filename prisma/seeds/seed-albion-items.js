const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
	console.log('Start seeding...');
	const itemsJSON = require('../items.json');

	// Use Promise.all for parallel processing
	const results = await Promise.allSettled(
		itemsJSON.map(async (item) => {
			const [mainPart, enchantmentPart] = item.UniqueName.split('@');
			const tierPart = mainPart.split('_')[0];
			const tier = parseInt(tierPart.slice(1), 10);
			const enchantment = enchantmentPart ? parseInt(enchantmentPart, 10) : 0;

			try {
				return await prisma.albionItem.upsert({
					where: { itemId: item.UniqueName }, // Changed to use itemId field
					update: {
						// Add fields you might want to update if item exists
						name: item.LocalizedNames['EN-US'],
						tier,
						enchantment
					},
					create: {
						itemId: item.UniqueName,
						name: item.LocalizedNames['EN-US'],
						tier,
						enchantment
					}
				});
			} catch (e) {
				console.error('Error saving item', item.UniqueName, e.message);
				return null;
			}
		})
	);

	const successful = results.filter((r) => r.status === 'fulfilled' && r.value);
	console.log(`Seeded ${successful.length}/${itemsJSON.length} items`);
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error('Seeding failed:', e);
		await prisma.$disconnect();
		process.exit(1);
	});
