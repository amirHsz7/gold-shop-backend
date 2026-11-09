import "dotenv/config";
import { prisma, disconnectDatabase } from "../src/lib/prisma.js";

const productSlugs = [
  "classic-chain-bracelet", "delicate-chain-bracelet", "leather-gold-bracelet",
  "plain-bangle", "patterned-bangle", "cartier-bangle",
  "italian-chain-necklace", "rolo-chain-necklace",
  "heart-pendant", "name-pendant", "evil-eye-pendant",
  "classic-wedding-ring", "patterned-wedding-ring",
  "gemstone-ring", "mens-ring", "cartier-ring",
  "hoop-earrings", "stud-earrings",
  "inactive-bracelet", "deleted-necklace",
];

// اول زیردسته‌ها، بعد دسته‌های اصلی
const categorySlugs = [
  "bracelet-chain", "bangle", "necklace-chain", "pendant", "wedding-ring",
  "bracelet", "necklace", "ring", "earring",
];

const collectionSlugs = ["spring", "bride", "daily", "old-collection"];

async function main() {
  const confirmed = process.argv.includes("--yes");

  const [products, categories, collections] = await Promise.all([
    prisma.product.count({ where: { slug: { in: productSlugs } } }),
    prisma.category.count({ where: { slug: { in: categorySlugs } } }),
    prisma.collection.count({ where: { slug: { in: collectionSlugs } } }),
  ]);

  console.log(
    `Demo data found: ${products} products, ${categories} categories, ${collections} collections`,
  );

  if (!confirmed) {
    console.log("Dry run only. Add --yes to actually delete.");
    return;
  }

  // وزن‌ها، عکس‌ها و کامنت‌های این محصولات هم همراهشان پاک می‌شوند
  const deletedProducts = await prisma.product.deleteMany({
    where: { slug: { in: productSlugs } },
  });

  let deletedCategories = 0;

  for (const slug of categorySlugs) {
    try {
      const result = await prisma.category.deleteMany({ where: { slug } });
      deletedCategories += result.count;
    } catch {
      console.warn(
        `Category "${slug}" was kept: it still has products or subcategories.`,
      );
    }
  }

  // محصولاتی که به کالکشن وصل بودند فقط از آن خارج می‌شوند
  const deletedCollections = await prisma.collection.deleteMany({
    where: { slug: { in: collectionSlugs } },
  });

  console.log(
    `Deleted: ${deletedProducts.count} products, ${deletedCategories} categories, ${deletedCollections.count} collections`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);