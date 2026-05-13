const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../Models/User.Model");
const connectDB = require("../Database/Connection");

const createAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = "admin@gmail.com";
    const adminPassword = "Test@123";

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log("Admin user already exists.");
      process.exit(0);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const adminUser = new User({
      name: "Super Admin",
      email: adminEmail,
      phone: "1234567890",
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });

    await adminUser.save();
    console.log("Admin user created successfully!");
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin user:", error);
    process.exit(1);
  }
};

createAdmin();
