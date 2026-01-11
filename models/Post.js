import mongoose from "mongoose";

const postSchema = mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: String,
    mediaUrl: { type: String, required: true },
    mediaType: { type: String, enum: ["image", "video"], required: true },
    caption: String,
    likes: { type: [String], default: [] },
    comments: [
        {
            userId: String,
            userName: String,
            text: String,
            createdAt: { type: Date, default: Date.now },
        },
    ],
    shares: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Post", postSchema);
