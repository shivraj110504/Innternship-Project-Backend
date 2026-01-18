import Post from "../models/Post.js";
import User from "../models/auth.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

export const createPost = async (req, res) => {
    const { mediaUrl, mediaType, caption } = req.body;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const friendsCount = Array.isArray(user.friends) ? user.friends.length : 0;

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

        // 1 friend = 1 post, 2-10 friends = 2 posts
        let limit = 0;
        if (friendsCount === 1) limit = 1;
        else if (friendsCount >= 2 && friendsCount <= 10) limit = 2;
        else if (friendsCount > 10) limit = Infinity;

        if (postsToday >= limit) {
            return res.status(429).json({
                message: `You can post only ${limit} time${limit > 1 ? "s" : ""} a day based on your friends count.`,
            });
        }

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

export const sendFriendRequest = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });
    if (userId === friendId) return res.status(400).json({ message: "You cannot add yourself as friend" });

    try {
        const user = await User.findById(userId);
        const targetUser = await User.findById(friendId);

        if (!user || !targetUser) return res.status(404).json({ message: "User not found" });

        const isAlreadyFriend = user.friends.some(id => id.toString() === friendId.toString());
        if (isAlreadyFriend) return res.status(400).json({ message: "Already friends" });

        const isRequestAlreadySent = user.sentFriendRequests.some(id => id.toString() === friendId.toString());
        if (isRequestAlreadySent) return res.status(400).json({ message: "Request already sent" });

        // Atomic update
        await Promise.all([
            User.findByIdAndUpdate(userId, { $addToSet: { sentFriendRequests: friendId } }),
            User.findByIdAndUpdate(friendId, { $addToSet: { receivedFriendRequests: userId } })
        ]);

        await Notification.create({
            recipient: friendId,
            sender: userId,
            type: "FRIEND_REQUEST"
        });

        console.log(`[FRIEND] Request sent from ${userId} to ${friendId}`);
        res.status(200).json({ message: "Friend request sent" });
    } catch (error) {
        console.error("Send Friend Request Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const confirmFriendRequest = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.userid;

    try {
        // Atomic updates
        const [updatedUser, updatedFriend] = await Promise.all([
            User.findByIdAndUpdate(userId, {
                $pull: { receivedFriendRequests: friendId },
                $addToSet: { friends: friendId }
            }, { new: true }),
            User.findByIdAndUpdate(friendId, {
                $pull: { sentFriendRequests: userId },
                $addToSet: { friends: userId }
            }, { new: true })
        ]);

        if (!updatedUser || !updatedFriend) return res.status(404).json({ message: "User not found" });

        await Notification.create({
            recipient: friendId,
            sender: userId,
            type: "FRIEND_ACCEPT"
        });

        console.log(`[FRIEND] Request confirmed between ${userId} and ${friendId}`);
        res.status(200).json({ message: "Friend request confirmed" });
    } catch (error) {
        console.error("Confirm Friend Request Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const rejectFriendRequest = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.userid;

    try {
        await Promise.all([
            User.findByIdAndUpdate(userId, { $pull: { receivedFriendRequests: friendId } }),
            User.findByIdAndUpdate(friendId, { $pull: { sentFriendRequests: userId } })
        ]);

        await Notification.create({
            recipient: friendId,
            sender: userId,
            type: "FRIEND_REJECT"
        });

        console.log(`[FRIEND] Request rejected by ${userId} for ${friendId}`);
        res.status(200).json({ message: "Friend request rejected" });
    } catch (error) {
        console.error("Reject Friend Request Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getFriends = async (req, res) => {
    const userId = req.userid;
    try {
        const userData = await User.findById(userId).populate("friends", "name email joinDate");
        if (!userData) return res.status(404).json({ message: "User not found" });
        res.status(200).json(userData.friends || []);
    } catch (error) {
        console.error("getFriends Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getFriendRequests = async (req, res) => {
    const userId = req.userid;
    try {
        const userData = await User.findById(userId).populate("receivedFriendRequests", "name email joinDate");
        if (!userData) return res.status(404).json({ message: "User not found" });
        res.status(200).json(userData.receivedFriendRequests || []);
    } catch (error) {
        console.error("getFriendRequests Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getNotifications = async (req, res) => {
    const userId = req.userid;
    try {
        const notifications = await Notification.find({ recipient: userId })
            .populate("sender", "name")
            .sort({ createdAt: -1 });
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const markNotificationsRead = async (req, res) => {
    const userId = req.userid;
    try {
        await Notification.updateMany({ recipient: userId, read: false }, { read: true });
        res.status(200).json({ message: "Notifications marked as read" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const searchUsers = async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(200).json([]);

    try {
        const cleanQuery = query.replace(/^@/, "");
        const results = await User.find({
            $or: [
                { name: { $regex: cleanQuery, $options: "i" } },
                { email: { $regex: cleanQuery, $options: "i" } }
            ]
        }).select("name email friends sentFriendRequests receivedFriendRequests joinDate about tags");

        const me = req.userid ? await User.findById(req.userid) : null;

        const usersWithStatus = results.map(u => {
            let status = "none";
            if (me) {
                const uid = u._id.toString();
                // Check if it's "me"
                if (uid === me._id.toString()) return null;

                if (me.friends.some(id => id.toString() === uid)) {
                    status = "friends";
                } else if (me.sentFriendRequests.some(id => id.toString() === uid)) {
                    status = "request_sent";
                } else if (me.receivedFriendRequests.some(id => id.toString() === uid)) {
                    status = "request_received";
                }
            }
            return { ...u.toObject(), friendStatus: status };
        }).filter(u => u !== null);

        res.status(200).json(usersWithStatus);
    } catch (error) {
        console.error("searchUsers Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const removeFriend = async (req, res) => {
    const { friendId } = req.params;
    const userId = req.userid;

    try {
        await Promise.all([
            User.findByIdAndUpdate(userId, { $pull: { friends: friendId } }),
            User.findByIdAndUpdate(friendId, { $pull: { friends: userId } })
        ]);

        console.log(`[FRIEND] Removed friend relationship between ${userId} and ${friendId}`);
        res.status(200).json({ message: "Friend removed" });
    } catch (error) {
        console.error("Remove Friend Error:", error);
        res.status(500).json({ message: error.message });
    }
};
