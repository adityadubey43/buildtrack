// Check all users and their roles
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/buildtrack";

async function checkUsers() {
  try {
    console.log("📦 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected!\n");

    const users = await User.find({}).select("name email role tenantId");
    
    if (users.length === 0) {
      console.log("No users found.");
      await mongoose.connection.close();
      return;
    }

    console.log(`📋 Found ${users.length} user(s):\n`);
    users.forEach((u, i) => {
      console.log(`${i + 1}. Name: ${u.name}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Role: ${u.role}`);
      console.log(`   Tenant: ${u.tenantId}\n`);
    });

    await mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

checkUsers();
