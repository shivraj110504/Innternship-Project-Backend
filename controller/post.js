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

        // Define 'friends' as number of people the user follows
        const friendsCount = Array.isArray(user.following) ? user.following.length : 0;

        // Rule: if no friends, cannot post
        if (friendsCount === 0) {
            return res.status(403).json({ message: "You cannot post anything on the public page until you have at least 1 friend." });
        }

        // Rule: Posting limit logic based on friends count
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const postsToday = await Post.countDocuments({
            userId,
            createdAt: { $gte: today },
        });

        if (friendsCount >= 1 && friendsCount <= 10) {
            if (postsToday >= friendsCount) {
                return res.status(429).json({
                    message: `You can post only ${friendsCount} time${friendsCount > 1 ? "s" : ""} a day based on your friends count.`,
                });
            }
        }
        // If friendsCount > 10, no limit (multiple times)

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
        // Use lean() to get fresh data without Mongoose caching issues
        const user = await User.findById(userId);
        const targetUser = await User.findById(followId);

        if (!user) return res.status(404).json({ message: "Current user not found" });
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // Ensure arrays exist and initialize if needed
        if (!Array.isArray(user.following)) user.following = [];
        if (!Array.isArray(user.followers)) user.followers = [];
        if (!Array.isArray(targetUser.following)) targetUser.following = [];
        if (!Array.isArray(targetUser.followers)) targetUser.followers = [];

        const followIdStr = String(followId);
        const userIdStr = String(userId);

        // Check current following status using fresh array
        const isFollowing = user.following.some((id) => String(id) === followIdStr);

        if (!isFollowing) {
            // FOLLOW: Add to respective arrays (check for duplicates first)
            const alreadyInFollowing = user.following.some((id) => String(id) === followIdStr);
            const alreadyInFollowers = targetUser.followers.some((id) => String(id) === userIdStr);

            if (!alreadyInFollowing) {
                user.following.push(followId);
                user.markModified('following');
            }
            if (!alreadyInFollowers) {
                targetUser.followers.push(userId);
                targetUser.markModified('followers');
            }
            
            // Save both users atomically
            await Promise.all([
                user.save(),
                targetUser.save()
            ]);
            
            // Reload fresh data from database to ensure accuracy
            const updatedUser = await User.findById(userId).select('following followers');
            const updatedTargetUser = await User.findById(followId).select('following followers');
            
            if (!updatedUser || !updatedTargetUser) {
                return res.status(500).json({ message: "Failed to verify user data" });
            }

            // Verify the operation succeeded
            const verifyFollowing = (updatedUser.following || []).some((id) => String(id) === followIdStr);
            
            res.status(200).json({
                message: "Followed successfully",
                isFollowing: true,
                current: {
                    _id: updatedUser._id,
                    following: updatedUser.following || [],
                    followers: updatedUser.followers || [],
                    counts: { 
                        following: (updatedUser.following || []).length, 
                        followers: (updatedUser.followers || []).length 
                    }
                },
                target: {
                    _id: updatedTargetUser._id,
                    following: updatedTargetUser.following || [],
                    followers: updatedTargetUser.followers || [],
                    counts: { 
                        following: (updatedTargetUser.following || []).length, 
                        followers: (updatedTargetUser.followers || []).length 
                    }
                }
            });
        } else {
            // UNFOLLOW: remove from respective arrays
            user.following = user.following.filter(id => String(id) !== followIdStr);
            targetUser.followers = targetUser.followers.filter(id => String(id) !== userIdStr);
            
            // Mark arrays as modified
            user.markModified('following');
            targetUser.markModified('followers');
            
            // Save both users atomically
            await Promise.all([
                user.save(),
                targetUser.save()
            ]);
            
            // Reload fresh data from database to ensure accuracy
            const updatedUser = await User.findById(userId).select('following followers');
            const updatedTargetUser = await User.findById(followId).select('following followers');
            
            if (!updatedUser || !updatedTargetUser) {
                return res.status(500).json({ message: "Failed to verify user data" });
            }

            // Verify the operation succeeded
            const verifyNotFollowing = !(updatedUser.following || []).some((id) => String(id) === followIdStr);
            
            res.status(200).json({
                message: "Unfollowed successfully",
                isFollowing: false,
                current: {
                    _id: updatedUser._id,
                    following: updatedUser.following || [],
                    followers: updatedUser.followers || [],
                    counts: { 
                        following: (updatedUser.following || []).length, 
                        followers: (updatedUser.followers || []).length 
                    }
                },
                target: {
                    _id: updatedTargetUser._id,
                    following: updatedTargetUser.following || [],
                    followers: updatedTargetUser.followers || [],
                    counts: { 
                        following: (updatedTargetUser.following || []).length, 
                        followers: (updatedTargetUser.followers || []).length 
                    }
                }
            });
        }
    } catch (error) {
        console.error("Follow user error:", error);
        res.status(500).json({ message: error.message || "An error occurred while processing your request" });
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
