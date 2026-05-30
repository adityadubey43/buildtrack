// Backfill slugs for tenants created before the slug field existed.
require("dotenv").config();
const mongoose = require("mongoose");
const Tenant = require("../src/models/Tenant");
const { generateUniqueSlug } = require("../src/utils/generateToken");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, family: 4 });
  const tenants = await Tenant.find({ $or: [{ slug: { $exists: false } }, { slug: null }] });
  console.log(`Found ${tenants.length} tenant(s) without a slug.`);
  for (const t of tenants) {
    t.slug = await generateUniqueSlug(Tenant, t.companyName);
    await t.save();
    console.log(`  ${t.companyName} → /c/${t.slug}`);
  }
  console.log("Done.");
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
