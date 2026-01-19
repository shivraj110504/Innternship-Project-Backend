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

    try {
        const uId = new mongoose.Types.ObjectId(userId);
        const fId = new mongoose.Types.ObjectId(friendId);

        if (uId.equals(fId)) return res.status(400).json({ message: "You cannot add yourself as friend" });

        const [user, targetUser] = await Promise.all([
            User.findById(uId),
            User.findById(fId)
        ]);

        if (!user || !targetUser) return res.status(404).json({ message: "User not found" });

        const isAlreadyFriend = user.friends.some(id => id.toString() === fId.toString());
        if (isAlreadyFriend) return res.status(400).json({ message: "Already friends" });

        const isRequestAlreadySent = user.sentFriendRequests.some(id => id.toString() === fId.toString());
        if (isRequestAlreadySent) return res.status(400).json({ message: "Request already sent" });

        // Atomic update
        await Promise.all([
            User.findByIdAndUpdate(uId, { $addToSet: { sentFriendRequests: fId } }),
            User.findByIdAndUpdate(fId, { $addToSet: { receivedFriendRequests: uId } })
        ]);

        await Notification.create({
            recipient: fId,
            sender: uId,
            type: "FRIEND_REQUEST"
        });

        console.log(`[FRIEND] Request sent from ${uId} to ${fId}`);
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
        const uId = new mongoose.Types.ObjectId(userId);
        const fId = new mongoose.Types.ObjectId(friendId);

        // Atomic updates: remove from requests AND add to friends
        const [updatedUser, updatedFriend] = await Promise.all([
            User.findByIdAndUpdate(uId, {
                $pull: { receivedFriendRequests: fId, sentFriendRequests: fId },
                $addToSet: { friends: fId }
            }, { new: true }),
            User.findByIdAndUpdate(fId, {
                $pull: { sentFriendRequests: uId, receivedFriendRequests: uId },
                $addToSet: { friends: uId }
            }, { new: true })
        ]);

        if (!updatedUser || !updatedFriend) return res.status(404).json({ message: "User not found" });

        await Notification.create({
            recipient: fId,
            sender: uId,
            type: "FRIEND_ACCEPT"
        });

        console.log(`[FRIEND] Request confirmed between ${uId} and ${fId}`);
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
        const uId = new mongoose.Types.ObjectId(userId);
        const fId = new mongoose.Types.ObjectId(friendId);

        await Promise.all([
            User.findByIdAndUpdate(uId, { $pull: { receivedFriendRequests: fId } }),
            User.findByIdAndUpdate(fId, { $pull: { sentFriendRequests: uId } })
        ]);

        await Notification.create({
            recipient: fId,
            sender: uId,
            type: "FRIEND_REJECT"
        });

        console.log(`[FRIEND] Request rejected by ${uId} for ${fId}`);
        res.status(200).json({ message: "Friend request rejected" });
    } catch (error) {
        console.error("Reject Friend Request Error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getFriends = async (req, res) => {
    const userId = req.userid;
    try {
        if (!userId) return res.status(403).json({ message: "Unauthenticated" });
        const userData = await User.findById(userId).populate("friends", "name email joinDate");
        if (!userData) return res.status(404).json({ message: "User not found" });

        // Ensure friends is an array before filtering
        const friendsList = Array.isArray(userData.friends) ? userData.friends : [];
        const activeFriends = friendsList.filter(f => f && f._id);

        res.status(200).json(activeFriends);
    } catch (error) {
        console.error("getFriends Error:", error);
        res.status(500).json({ message: error.message || "Failed to fetch friends" });
    }
};

export const getFriendRequests = async (req, res) => {
    const userId = req.userid;
    try {
        if (!userId) return res.status(403).json({ message: "Unauthenticated" });
        const userData = await User.findById(userId).populate("receivedFriendRequests", "name email joinDate");
        if (!userData) return res.status(404).json({ message: "User not found" });

        const requestsList = Array.isArray(userData.receivedFriendRequests) ? userData.receivedFriendRequests : [];
        const activeRequests = requestsList.filter(r => r && r._id);

        res.status(200).json(activeRequests);
    } catch (error) {
        console.error("getFriendRequests Error:", error);
        res.status(500).json({ message: error.message || "Failed to fetch friend requests" });
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
        const cleanQuery = query.replace(/^@/, "").trim();
        // Use a case-insensitive regex that escapes potential special characters
        const safeQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(safeQuery, "i");

        const results = await User.find({
            $or: [
                { name: { $regex: regex } },
                { email: { $regex: regex } },
                { handle: { $regex: regex } }
            ]
        }).select("name email handle friends sentFriendRequests receivedFriendRequests joinDate about tags").lean();

        const myIdString = req.userid ? String(req.userid) : null;

        const usersWithStatus = results.map(u => {
            // Check if it's "me"
            if (String(u._id) === myIdString) return null;

            let status = "none";
            if (myIdString) {
                const uidString = String(u._id);

                // Compare with current user's friend lists
                // Note: Since we used .lean(), we need to handle these as POJOs or find the 'me' doc
                // To keep it simple and correct, we'll check if u._id is in me's lists
                // But we don't have 'me' doc here yet to avoid another query if possible.
                // However, statuses like friendStatus are usually better fetched by checking the current user's lists.
            }
            return { ...u, friendStatus: status };
        }).filter(u => u !== null);

        // If we want status, we DO need the 'me' document once.
        if (myIdString && usersWithStatus.length > 0) {
            const me = await User.findById(myIdString).lean();
            if (me) {
                usersWithStatus.forEach(tempUser => {
                    const tid = String(tempUser._id);
                    if (me.friends && me.friends.some(id => String(id) === tid)) {
                        tempUser.friendStatus = "friends";
                    } else if (me.sentFriendRequests && me.sentFriendRequests.some(id => String(id) === tid)) {
                        tempUser.friendStatus = "request_sent";
                    } else if (me.receivedFriendRequests && me.receivedFriendRequests.some(id => String(id) === tid)) {
                        tempUser.friendStatus = "request_received";
                    }
                });
            }
        }

        res.status(200).json(usersWithStatus);
    } catch (error) {
        console.error("searchUsers Error:", error);
        res.status(500).json({ message: "Failed to search users" });
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

export const sharePost = async (req, res) => {
    const { id } = req.params;
    try {
        const updatedPost = await Post.findByIdAndUpdate(id, { $inc: { shares: 1 } }, { new: true });
        res.status(200).json(updatedPost);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
