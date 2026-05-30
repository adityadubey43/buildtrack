const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("crypto");

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const generateTenantId = () => {
  return "tenant_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
};

const generateInvoiceNumber = (tenantId, count) => {
  const prefix = "INV";
  const num = String(count + 1).padStart(3, "0");
  return `${prefix}-${num}`;
};

// Turn a company name into a URL-safe slug
const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "company";

// Generate a slug that is unique across tenants
const generateUniqueSlug = async (TenantModel, companyName) => {
  const base = slugify(companyName);
  let slug = base;
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await TenantModel.exists({ slug })) {
    slug = `${base}-${n++}`;
  }
  return slug;
};

module.exports = { generateToken, generateTenantId, generateInvoiceNumber, slugify, generateUniqueSlug };
