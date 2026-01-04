import mongoose from 'mongoose';
import user from './models/auth.js';
import dotenv from 'dotenv';
dotenv.config();

const databaseurl = process.env.MONGODB_URL || "mongodb://localhost:27017/stackoverflow";

mongoose.connect(databaseurl)
    .then(async () => {
        console.log("Connected to MongoDB. Target collection:", user.collection.name);
        const users = await user.find({});
        console.log("Documents found in 'users' collection:", users.length);
        if (users.length > 0) {
            users.forEach(u => {
                console.log(`- ${u.name} (${u.email}) ID: ${u._id}`);
            });
        } else {
            console.log("No users found in the collection.");
        }
        process.exit(0);
    })
    .catch(err => {
        console.error("Error connecting to MongoDB:", err);
        process.exit(1);
    });
