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

        // Define 'friends' as confirmed friends (mutual friends)
        const friendsCount = Array.isArray(user.friends) ? user.friends.length : 0;

        // Rule: if no friends, cannot post
        if (friendsCount === 0) {
            return res.status(403).json({ message: "You cannot post anything on the public page until you have at least 1 confirmed friend." });
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

// Send friend request
export const sendFriendRequest = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });
    if (userId === friendId) return res.status(400).json({ message: "You cannot send a friend request to yourself" });

    try {
        const user = await User.findById(userId);
        const targetUser = await User.findById(friendId);

        if (!user) return res.status(404).json({ message: "Current user not found" });
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // Ensure arrays exist
        if (!Array.isArray(user.friends)) user.friends = [];
        if (!Array.isArray(user.sentFriendRequests)) user.sentFriendRequests = [];
        if (!Array.isArray(user.receivedFriendRequests)) user.receivedFriendRequests = [];
        if (!Array.isArray(targetUser.friends)) targetUser.friends = [];
        if (!Array.isArray(targetUser.sentFriendRequests)) targetUser.sentFriendRequests = [];
        if (!Array.isArray(targetUser.receivedFriendRequests)) targetUser.receivedFriendRequests = [];

        const friendIdStr = String(friendId);
        const userIdStr = String(userId);

        // Check if already friends
        const alreadyFriends = user.friends.some((id) => String(id) === friendIdStr);
        if (alreadyFriends) {
            return res.status(400).json({ message: "You are already friends with this user" });
        }

        // Check if request already sent
        const requestAlreadySent = user.sentFriendRequests.some((id) => String(id) === friendIdStr);
        if (requestAlreadySent) {
            return res.status(400).json({ message: "Friend request already sent" });
        }

        // Check if request already received (they sent you one first)
        const requestReceived = user.receivedFriendRequests.some((id) => String(id) === friendIdStr);
        if (requestReceived) {
            return res.status(400).json({ message: "This user has already sent you a friend request. Please confirm it instead." });
        }

        // Send friend request
        user.sentFriendRequests.push(friendId);
        targetUser.receivedFriendRequests.push(userId);

        user.markModified('sentFriendRequests');
        targetUser.markModified('receivedFriendRequests');

        await Promise.all([user.save(), targetUser.save()]);

        // Reload fresh data
        const updatedUser = await User.findById(userId);
        const updatedTargetUser = await User.findById(friendId);

        res.status(200).json({
            message: "Friend request sent successfully",
            status: "pending",
            current: {
                _id: updatedUser._id,
                friends: updatedUser.friends || [],
                friendsCount: (updatedUser.friends || []).length,
                sentRequests: updatedUser.sentFriendRequests || [],
                receivedRequests: updatedUser.receivedFriendRequests || []
            },
            target: {
                _id: updatedTargetUser._id,
                friends: updatedTargetUser.friends || [],
                friendsCount: (updatedTargetUser.friends || []).length,
                sentRequests: updatedTargetUser.sentFriendRequests || [],
                receivedRequests: updatedTargetUser.receivedFriendRequests || []
            }
        });
    } catch (error) {
        console.error("Send friend request error:", error);
        res.status(500).json({ message: error.message || "An error occurred while processing your request" });
    }
};

// Confirm friend request
export const confirmFriendRequest = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const user = await User.findById(userId);
        const targetUser = await User.findById(friendId);

        if (!user) return res.status(404).json({ message: "Current user not found" });
        if (!targetUser) return res.status(404).json({ message: "User not found" });

        // Ensure arrays exist
        if (!Array.isArray(user.friends)) user.friends = [];
        if (!Array.isArray(user.sentFriendRequests)) user.sentFriendRequests = [];
        if (!Array.isArray(user.receivedFriendRequests)) user.receivedFriendRequests = [];
        if (!Array.isArray(targetUser.friends)) targetUser.friends = [];
        if (!Array.isArray(targetUser.sentFriendRequests)) targetUser.sentFriendRequests = [];
        if (!Array.isArray(targetUser.receivedFriendRequests)) targetUser.receivedFriendRequests = [];

        const friendIdStr = String(friendId);
        const userIdStr = String(userId);

        // Check if request exists
        const hasReceivedRequest = user.receivedFriendRequests.some((id) => String(id) === friendIdStr);
        if (!hasReceivedRequest) {
            return res.status(400).json({ message: "No friend request found from this user" });
        }

        // Check if already friends
        const alreadyFriends = user.friends.some((id) => String(id) === friendIdStr);
        if (alreadyFriends) {
            return res.status(400).json({ message: "You are already friends with this user" });
        }

        // Remove from received/sent requests
        user.receivedFriendRequests = user.receivedFriendRequests.filter(id => String(id) !== friendIdStr);
        targetUser.sentFriendRequests = targetUser.sentFriendRequests.filter(id => String(id) !== userIdStr);

        // Add to friends (both ways)
        if (!user.friends.some((id) => String(id) === friendIdStr)) {
            user.friends.push(friendId);
        }
        if (!targetUser.friends.some((id) => String(id) === userIdStr)) {
            targetUser.friends.push(userId);
        }

        user.markModified('friends');
        user.markModified('receivedFriendRequests');
        targetUser.markModified('friends');
        targetUser.markModified('sentFriendRequests');

        await Promise.all([user.save(), targetUser.save()]);

        // Reload fresh data
        const updatedUser = await User.findById(userId);
        const updatedTargetUser = await User.findById(friendId);

        res.status(200).json({
            message: "Friend request confirmed. You are now friends!",
            status: "friends",
            current: {
                _id: updatedUser._id,
                friends: updatedUser.friends || [],
                friendsCount: (updatedUser.friends || []).length,
                sentRequests: updatedUser.sentFriendRequests || [],
                receivedRequests: updatedUser.receivedFriendRequests || []
            },
            target: {
                _id: updatedTargetUser._id,
                friends: updatedTargetUser.friends || [],
                friendsCount: (updatedTargetUser.friends || []).length,
                sentRequests: updatedTargetUser.sentFriendRequests || [],
                receivedRequests: updatedTargetUser.receivedFriendRequests || []
            }
        });
    } catch (error) {
        console.error("Confirm friend request error:", error);
        res.status(500).json({ message: error.message || "An error occurred while processing your request" });
    }
};

// Reject/Cancel friend request
export const rejectFriendRequest = async (req, res) => {
    const { friendId } = req.body;
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const user = await User.findById(userId);
        const targetUser = await User.findById(friendId);

        if (!user || !targetUser) return res.status(404).json({ message: "User not found" });

        const friendIdStr = String(friendId);
        const userIdStr = String(userId);

        // Check if request exists in received requests (rejecting)
        const hasReceivedRequest = user.receivedFriendRequests.some((id) => String(id) === friendIdStr);
        if (hasReceivedRequest) {
            user.receivedFriendRequests = user.receivedFriendRequests.filter(id => String(id) !== friendIdStr);
            targetUser.sentFriendRequests = targetUser.sentFriendRequests.filter(id => String(id) !== userIdStr);
            user.markModified('receivedFriendRequests');
            targetUser.markModified('sentFriendRequests');
        } else {
            // Check if request exists in sent requests (canceling)
            const hasSentRequest = user.sentFriendRequests.some((id) => String(id) === friendIdStr);
            if (hasSentRequest) {
                user.sentFriendRequests = user.sentFriendRequests.filter(id => String(id) !== friendIdStr);
                targetUser.receivedFriendRequests = targetUser.receivedFriendRequests.filter(id => String(id) !== userIdStr);
                user.markModified('sentFriendRequests');
                targetUser.markModified('receivedFriendRequests');
            } else {
                return res.status(400).json({ message: "No friend request found" });
            }
        }

        await Promise.all([user.save(), targetUser.save()]);

        const updatedUser = await User.findById(userId);
        const updatedTargetUser = await User.findById(friendId);

        res.status(200).json({
            message: "Friend request rejected/cancelled",
            status: "none",
            current: {
                _id: updatedUser._id,
                friends: updatedUser.friends || [],
                friendsCount: (updatedUser.friends || []).length,
                sentRequests: updatedUser.sentFriendRequests || [],
                receivedRequests: updatedUser.receivedFriendRequests || []
            },
            target: {
                _id: updatedTargetUser._id,
                friends: updatedTargetUser.friends || [],
                friendsCount: (updatedTargetUser.friends || []).length,
                sentRequests: updatedTargetUser.sentFriendRequests || [],
                receivedRequests: updatedTargetUser.receivedFriendRequests || []
            }
        });
    } catch (error) {
        console.error("Reject friend request error:", error);
        res.status(500).json({ message: error.message || "An error occurred while processing your request" });
    }
};

// Backward compatibility: keep followUser name but use friend request system
export const followUser = sendFriendRequest;

export const searchUsers = async (req, res) => {
    const { query } = req.query;
    // Try to get userId from auth middleware (if route uses auth) or from query param
    const userId = req.userid || req.query.userId;

    if (!query) return res.status(200).json([]);

    try {
        const cleanQuery = query.replace(/^@/, "");
        const users = await User.find({
            $or: [
                { name: { $regex: cleanQuery, $options: "i" } },
                { email: { $regex: cleanQuery, $options: "i" } }
            ]
        }).select("name email friends sentFriendRequests receivedFriendRequests joinDate about tags");

        // Add friend status for current user if authenticated
        let usersWithStatus = users;
        if (userId) {
            const currentUser = await User.findById(userId);
            if (currentUser) {
                usersWithStatus = users.map(user => {
                    const userObj = user.toObject();
                    const userIdStr = String(userId);
                    const targetIdStr = String(user._id);

                    // Check if already friends
                    const isFriend = (currentUser.friends || []).some(id => String(id) === targetIdStr) ||
                                   (user.friends || []).some(id => String(id) === userIdStr);
                    
                    // Check if request sent
                    const requestSent = (currentUser.sentFriendRequests || []).some(id => String(id) === targetIdStr);
                    
                    // Check if request received
                    const requestReceived = (currentUser.receivedFriendRequests || []).some(id => String(id) === targetIdStr);

                    return {
                        ...userObj,
                        friendStatus: isFriend ? "friends" : requestSent ? "request_sent" : requestReceived ? "request_received" : "none",
                        friendsCount: (user.friends || []).length
                    };
                });
            }
        }

        console.log(`Search for "${query}" found ${users.length} users`);
        res.status(200).json(usersWithStatus);
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).json({ message: error.message });
    }
};

export const getFriends = async (req, res) => {
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const user = await User.findById(userId).populate('friends', 'name email joinDate about');
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.friends || []);
    } catch (error) {
        console.error("Get friends error:", error);
        res.status(500).json({ message: error.message || "Failed to fetch friends" });
    }
};

// Get friend requests (received)
export const getFriendRequests = async (req, res) => {
    const userId = req.userid;

    if (!userId) return res.status(403).json({ message: "Unauthenticated" });

    try {
        const user = await User.findById(userId).populate('receivedFriendRequests', 'name email joinDate about');
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json(user.receivedFriendRequests || []);
    } catch (error) {
        console.error("Get friend requests error:", error);
        res.status(500).json({ message: error.message || "Failed to fetch friend requests" });
    }
};

// Backward compatibility
export const getFollowers = getFriends;

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
