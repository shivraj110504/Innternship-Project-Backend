import Post from "../models/Post.js";
import User from "../models/auth.js";
import mongoose from "mongoose";

export const createPost = async (req, res) => {
    const { mediaUrl, mediaType, caption } = req.body;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const followerCount = user.followers ? user.followers.length : 0;
        const followingCount = user.following ? user.following.length : 0;

        // Rule: if no followers (friends), cannot post
        if (followerCount === 0) {
            return res.status(403).json({ message: "You cannot post anything on the public page until you have followers (friends)." });
        }

        // Rule: Posting limit logic
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const postsToday = await Post.countDocuments({
            userId,
            createdAt: { $gte: today },
        });

        if (followerCount >= 1 && followerCount <= 10) {
            if (postsToday >= followerCount) {
                return res.status(429).json({
                    message: `You can post only ${followerCount} time${followerCount > 1 ? "s" : ""} a day based on your follower count.`,
                });
            }
        }
        // If followerCount > 10, no limit (multiple times)

        const newPost = await Post.create({
            userId,
            userName: user.name,
            mediaUrl,
            mediaType,
            caption,
        });

        res.status(200).json(newPost);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getallposts = async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.status(200).json(posts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const likePost = async (req, res) => {
    const { id } = req.params;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const post = await Post.findById(id);
        const index = post.likes.findIndex((id) => id === String(userId));

        if (index === -1) {
            post.likes.push(userId);
        } else {
            post.likes = post.likes.filter((id) => id !== String(userId));
        }

        const updatedPost = await Post.findByIdAndUpdate(id, post, { new: true });
        res.status(200).json(updatedPost);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const commentPost = async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const user = await User.findById(userId);
        const post = await Post.findById(id);

        post.comments.push({
            userId,
            userName: user.name,
            text,
            createdAt: new Date(),
        });

        const updatedPost = await Post.findByIdAndUpdate(id, post, { new: true });
        res.status(200).json(updatedPost);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const followUser = async (req, res) => {
    const { followId } = req.body;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });
    if (userId === followId) return res.status(400).json({ message: "You cannot follow yourself" });

    try {
        const user = await User.findById(userId);
        const targetUser = await User.findById(followId);

        if (!targetUser) return res.status(404).json({ message: "User not found" });

        const isFollowing = user.following.includes(followId);

        if (!isFollowing) {
            // Mutual Follow
            user.following.push(followId);
            user.followers.push(followId); // A follows B, A gets a follower B
            targetUser.followers.push(userId);
            targetUser.following.push(userId); // B gets follower A, B follows A
            await user.save();
            await targetUser.save();
            res.status(200).json({ message: "Followed successfully", isFollowing: true });
        } else {
            // Mutual Unfollow
            user.following = user.following.filter(id => id.toString() !== followId);
            user.followers = user.followers.filter(id => id.toString() !== followId);
            targetUser.followers = targetUser.followers.filter(id => id.toString() !== userId);
            targetUser.following = targetUser.following.filter(id => id.toString() !== userId);
            await user.save();
            await targetUser.save();
            res.status(200).json({ message: "Unfollowed successfully", isFollowing: false });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const searchUsers = async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(200).json([]);

    try {
        const cleanQuery = query.replace(/^@/, "");
        const users = await User.find({
            $or: [
                { name: { $regex: cleanQuery, $options: "i" } },
                { email: { $regex: cleanQuery, $options: "i" } }
            ]
        }).select("name email followers following joinDate about tags");

        console.log(`Search for "${query}" found ${users.length} users`);
        res.status(200).json(users);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: error.message });
    }
};
