// Training/stackoverflow/server/utils/addHandles.js
// Run this ONCE to add handles to existing users

import mongoose from "mongoose";
import User from "../models/auth.js";
import dotenv from "dotenv";

dotenv.config();

const addHandlesToExistingUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ Connected to MongoDB");

    // Find all users without handles
    const usersWithoutHandles = await User.find({
      $or: [
        { handle: { $exists: false } },
        { handle: null },
        { handle: "" }
      ]
    });

    console.log(`Found ${usersWithoutHandles.length} users without handles`);

    for (const user of usersWithoutHandles) {
      // Generate handle from name
      let baseHandle = user.name.toLowerCase().replace(/\s+/g, "");
      let handle = baseHandle;
      let counter = 1;

      // Check if handle exists, if so add number
      while (await User.findOne({ handle, _id: { $ne: user._id } })) {
        handle = `${baseHandle}${counter}`;
        counter++;
      }

      user.handle = handle;
      await user.save();
      console.log(`✅ Added handle "${handle}" to user "${user.name}"`);
    }

    console.log("✅ Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
};

addHandlesToExistingUsers();