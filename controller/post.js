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
            // Asymmetric Follow: only update respective arrays
            user.following.push(followId);           // Add to YOUR following list
            targetUser.followers.push(userId);       // Add YOU to THEIR followers list
            await user.save();
            await targetUser.save();
            res.status(200).json({
                message: "Followed successfully",
                isFollowing: true,
                current: {
                    _id: user._id,
                    following: user.following,
                    followers: user.followers,
                    counts: { following: user.following.length, followers: user.followers.length }
                },
                target: {
                    _id: targetUser._id,
                    following: targetUser.following,
                    followers: targetUser.followers,
                    counts: { following: targetUser.following.length, followers: targetUser.followers.length }
                }
            });
        } else {
            // Unfollow: remove from respective arrays
            user.following = user.following.filter(id => id.toString() !== followId);
            targetUser.followers = targetUser.followers.filter(id => id.toString() !== userId);
            await user.save();
            await targetUser.save();
            res.status(200).json({
                message: "Unfollowed successfully",
                isFollowing: false,
                current: {
                    _id: user._id,
                    following: user.following,
                    followers: user.followers,
                    counts: { following: user.following.length, followers: user.followers.length }
                },
                target: {
                    _id: targetUser._id,
                    following: targetUser.following,
                    followers: targetUser.followers,
                    counts: { following: targetUser.following.length, followers: targetUser.followers.length }
                }
            });
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

export const getFollowers = async (req, res) => {
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const user = await User.findById(userId).populate('followers', 'name email joinDate');
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.followers);
    } catch (error) {
        console.error("Get followers error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const removeFollower = async (req, res) => {
    const { followerId } = req.params;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });
    if (userId === followerId) return res.status(400).json({ message: "Invalid operation" });

    try {
        const user = await User.findById(userId);
        const follower = await User.findById(followerId);

        if (!follower) return res.status(404).json({ message: "Follower not found" });

        // Remove follower from YOUR followers list
        user.followers = user.followers.filter(id => id.toString() !== followerId);

        // Remove YOU from THEIR following list
        follower.following = follower.following.filter(id => id.toString() !== userId);

        // ALSO remove them from YOUR following list (if you were following them)
        user.following = user.following.filter(id => id.toString() !== followerId);

        // ALSO remove you from THEIR followers list (if they had you as follower)
        follower.followers = follower.followers.filter(id => id.toString() !== userId);

        await user.save();
        await follower.save();

        res.status(200).json({ message: "Follower removed successfully" });
    } catch (error) {
        console.error("Remove follower error:", error);
        res.status(500).json({ message: error.message });
    }
};
