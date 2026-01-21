// controller/post.js - UPDATED createPost function

import Post from "../models/Post.js";
import User from "../models/auth.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";

// Create Post with friend-based posting limits
export const createPost = async (req, res) => {
  try {
    const userId = req.userid;
    const { mediaUrl, mediaType, caption } = req.body;

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check friend count for posting rules
    const friendsCount = user.friends?.length || 0;

    // Rule 1: Need at least 1 friend to post
    if (friendsCount === 0) {
      return res.status(403).json({
        message: "You need at least 1 friend to post on the community page.",
        friendsCount: 0,
        postsToday: 0,
        dailyLimit: 0,
      });
    }

    // Check daily post limit based on friends
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const postsToday = await Post.countDocuments({
      userId,
      createdAt: { $gte: today },
    });

    // Rule 2: Determine daily limit based on friend count
    let dailyLimit;
    if (friendsCount >= 10) {
      dailyLimit = Infinity; // Unlimited posts
    } else {
      dailyLimit = friendsCount; // 1-9 friends = same number of posts per day
    }

    // Rule 3: Check if user has reached daily limit
    if (postsToday >= dailyLimit && dailyLimit !== Infinity) {
      return res.status(403).json({
        message: `You can only post ${dailyLimit} time(s) per day with ${friendsCount} friend(s). Get 10+ friends for unlimited posts!`,
        postsToday,
        dailyLimit,
        friendsCount,
      });
    }

    // Create the post
    const newPost = await Post.create({
      userId,
      userName: user.name,
      mediaUrl,
      mediaType,
      caption: caption || "",
    });

    res.status(201).json({
      message: "Post created successfully",
      post: newPost,
      postsToday: postsToday + 1,
      dailyLimit: dailyLimit === Infinity ? "Unlimited" : dailyLimit,
      friendsCount,
    });
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({ message: error.message || "Failed to create post" });
  }
};

// Get all posts (public feed)
export const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("userId", "name handle")
      .lean();

    res.status(200).json(posts);
  } catch (error) {
    console.error("Get posts error:", error);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

// Get single post
export const getPost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id).populate("userId", "name handle");

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json(post);
  } catch (error) {
    console.error("Get post error:", error);
    res.status(500).json({ message: "Failed to fetch post" });
  }
};

// Like/Unlike post
export const likePost = async (req, res) => {
  try {
    const userId = req.userid;
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const likes = post.likes || [];
    const hasLiked = likes.includes(userId);

    if (hasLiked) {
      // Unlike
      post.likes = likes.filter((id) => id !== userId);
    } else {
      // Like
      post.likes.push(userId);

      // Create notification for post owner
      if (post.userId.toString() !== userId) {
        await Notification.create({
          userId: post.userId,
          type: "LIKE",
          message: `liked your post`,
          fromUserId: userId,
          relatedId: post._id,
        });
      }
    }

    await post.save();

    res.status(200).json({
      message: hasLiked ? "Post unliked" : "Post liked",
      likes: post.likes,
    });
  } catch (error) {
    console.error("Like post error:", error);
    res.status(500).json({ message: "Failed to like post" });
  }
};

// Comment on post
export const commentPost = async (req, res) => {
  try {
    const userId = req.userid;
    const { id } = req.params;
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const user = await User.findById(userId);
    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const comment = {
      userId,
      userName: user.name,
      text: text.trim(),
      createdAt: new Date(),
    };

    post.comments.push(comment);
    await post.save();

    // Create notification for post owner
    if (post.userId.toString() !== userId) {
      await Notification.create({
        userId: post.userId,
        type: "COMMENT",
        message: `commented on your post`,
        fromUserId: userId,
        relatedId: post._id,
      });
    }

    res.status(200).json({
      message: "Comment added",
      comments: post.comments,
    });
  } catch (error) {
    console.error("Comment post error:", error);
    res.status(500).json({ message: "Failed to add comment" });
  }
};

// Share post
export const sharePost = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    post.shares = (post.shares || 0) + 1;
    await post.save();

    res.status(200).json({
      message: "Post shared successfully",
      shares: post.shares,
    });
  } catch (error) {
    console.error("Share post error:", error);
    res.status(500).json({ message: "Failed to share post" });
  }
};

// Delete post
export const deletePost = async (req, res) => {
  try {
    const userId = req.userid;
    const { id } = req.params;

    const post = await Post.findById(id);

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.userId.toString() !== userId) {
      return res.status(403).json({ message: "You can only delete your own posts" });
    }

    await Post.findByIdAndDelete(id);

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ message: "Failed to delete post" });
  }
};

// Get user's posts
export const getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;

    const posts = await Post.find({ userId })
      .sort({ createdAt: -1 })
      .populate("userId", "name handle");

    res.status(200).json(posts);
  } catch (error) {
    console.error("Get user posts error:", error);
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
};

// Get user's posting stats
export const getPostingStats = async (req, res) => {
  try {
    const userId = req.userid;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const friendsCount = user.friends?.length || 0;

    // Get today's post count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const postsToday = await Post.countDocuments({
      userId,
      createdAt: { $gte: today },
    });

    // Determine daily limit
    let dailyLimit;
    if (friendsCount === 0) {
      dailyLimit = 0;
    } else if (friendsCount >= 10) {
      dailyLimit = Infinity;
    } else {
      dailyLimit = friendsCount;
    }

    const canPost = friendsCount === 0 
      ? false 
      : (dailyLimit === Infinity || postsToday < dailyLimit);

    res.status(200).json({
      friendsCount,
      postsToday,
      dailyLimit: dailyLimit === Infinity ? "Unlimited" : dailyLimit,
      remainingPosts: dailyLimit === Infinity 
        ? "Unlimited" 
        : Math.max(0, dailyLimit - postsToday),
      canPost,
      message: friendsCount === 0
        ? "You need at least 1 friend to post"
        : canPost
        ? "You can create a post"
        : `Daily limit reached (${dailyLimit} posts with ${friendsCount} friends)`,
    });
  } catch (error) {
    console.error("Get posting stats error:", error);
    res.status(500).json({ message: "Failed to fetch posting stats" });
  }
};

// Send friend request - ALREADY EXISTS IN YOUR CODE
export const sendFriendRequest = async (req, res) => {
  try {
    const userId = req.userid;
    const { friendId } = req.body;

    console.log("🔔 Friend request received:", { userId, friendId });

    if (!friendId) {
      return res.status(400).json({ message: "Friend ID is required" });
    }

    if (userId === friendId) {
      return res.status(400).json({ message: "You cannot send a friend request to yourself" });
    }

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ message: "Invalid friend ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Your user account not found" });
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      console.error("❌ Friend not found:", friendId);
      return res.status(404).json({ message: "User not found" });
    }

    if (user.friends?.some(id => id.toString() === friendId)) {
      return res.status(400).json({ message: "Already friends" });
    }

    if (user.sentFriendRequests?.some(id => id.toString() === friendId)) {
      return res.status(400).json({ message: "Friend request already sent" });
    }

    if (user.receivedFriendRequests?.some(id => id.toString() === friendId)) {
      return res.status(400).json({ message: "This user already sent you a request. Please confirm it instead." });
    }

    user.sentFriendRequests = user.sentFriendRequests || [];
    user.sentFriendRequests.push(friendId);

    friend.receivedFriendRequests = friend.receivedFriendRequests || [];
    friend.receivedFriendRequests.push(userId);

    await user.save();
    await friend.save();

    await Notification.create({
      userId: friendId,
      type: "FRIEND_REQUEST",
      message: `sent you a friend request`,
      fromUserId: userId,
    });

    console.log("✅ Friend request sent successfully");
    res.status(200).json({ message: "Friend request sent successfully" });
  } catch (error) {
    console.error("❌ Send friend request error:", error);
    res.status(500).json({ message: error.message || "Failed to send friend request" });
  }
};

// Confirm friend request - ALREADY EXISTS IN YOUR CODE
export const confirmFriendRequest = async (req, res) => {
  try {
    const userId = req.userid;
    const { friendId } = req.body;

    console.log("✅ Confirm request received:", { userId, friendId });

    if (!friendId) {
      return res.status(400).json({ message: "Friend ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ message: "Invalid friend ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Your user account not found" });
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      console.error("❌ Friend not found:", friendId);
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.receivedFriendRequests?.some(id => id.toString() === friendId)) {
      return res.status(400).json({ message: "No friend request from this user" });
    }

    user.receivedFriendRequests = user.receivedFriendRequests.filter(
      (id) => id.toString() !== friendId
    );
    friend.sentFriendRequests = friend.sentFriendRequests.filter(
      (id) => id.toString() !== userId
    );

    user.friends = user.friends || [];
    user.friends.push(friendId);

    friend.friends = friend.friends || [];
    friend.friends.push(userId);

    await user.save();
    await friend.save();

    await Notification.create({
      userId: friendId,
      type: "FRIEND_ACCEPT",
      message: `accepted your friend request`,
      fromUserId: userId,
    });

    console.log("✅ Friend request confirmed successfully");
    res.status(200).json({ message: "Friend request confirmed" });
  } catch (error) {
    console.error("❌ Confirm friend request error:", error);
    res.status(500).json({ message: error.message || "Failed to confirm friend request" });
  }
};

// Reject friend request - ALREADY EXISTS IN YOUR CODE
export const rejectFriendRequest = async (req, res) => {
  try {
    const userId = req.userid;
    const { friendId } = req.body;

    console.log("❌ Reject request received:", { userId, friendId });

    if (!friendId) {
      return res.status(400).json({ message: "Friend ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ message: "Invalid friend ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Your user account not found" });
    }

    const friend = await User.findById(friendId);
    if (!friend) {
      console.error("❌ Friend not found:", friendId);
      return res.status(404).json({ message: "User not found" });
    }

    user.receivedFriendRequests = user.receivedFriendRequests.filter(
      (id) => id.toString() !== friendId
    );
    friend.sentFriendRequests = friend.sentFriendRequests.filter(
      (id) => id.toString() !== userId
    );

    await user.save();
    await friend.save();

    console.log("✅ Friend request rejected successfully");
    res.status(200).json({ message: "Friend request rejected" });
  } catch (error) {
    console.error("❌ Reject friend request error:", error);
    res.status(500).json({ message: error.message || "Failed to reject friend request" });
  }
};

// Get friends list
export const getFriends = async (req, res) => {
  try {
    const userId = req.userid;

    const user = await User.findById(userId).populate("friends", "name handle joinDate");

    res.status(200).json(user.friends || []);
  } catch (error) {
    console.error("Get friends error:", error);
    res.status(500).json({ message: "Failed to fetch friends" });
  }
};

// Get friend requests
export const getFriendRequests = async (req, res) => {
  try {
    const userId = req.userid;

    const user = await User.findById(userId).populate(
      "receivedFriendRequests",
      "name handle joinDate"
    );

    res.status(200).json(user.receivedFriendRequests || []);
  } catch (error) {
    console.error("Get friend requests error:", error);
    res.status(500).json({ message: "Failed to fetch friend requests" });
  }
};

// Remove friend
export const removeFriend = async (req, res) => {
  try {
    const userId = req.userid;
    const { friendId } = req.params;

    const user = await User.findById(userId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ message: "User not found" });
    }

    user.friends = user.friends.filter((id) => id.toString() !== friendId);
    friend.friends = friend.friends.filter((id) => id.toString() !== userId);

    await user.save();
    await friend.save();

    res.status(200).json({ message: "Friend removed successfully" });
  } catch (error) {
    console.error("Remove friend error:", error);
    res.status(500).json({ message: "Failed to remove friend" });
  }
};

// Search users - ALREADY EXISTS IN YOUR CODE
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.userid;

    if (!query || query.trim() === "") {
      return res.status(400).json({ message: "Search query is required" });
    }

    const cleanQuery = query.trim().replace(/^@/, "");

    console.log(`🔍 Search request - Query: "${cleanQuery}", User: ${currentUserId}`);

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { name: { $regex: cleanQuery, $options: "i" } },
        { handle: { $regex: cleanQuery, $options: "i" } },
        { email: { $regex: cleanQuery, $options: "i" } },
      ],
    })
      .select("name handle email joinDate friends sentFriendRequests receivedFriendRequests points")
      .limit(50)
      .lean();

    console.log(`✅ Found ${users.length} users for query "${cleanQuery}"`);

    const currentUser = await User.findById(currentUserId).lean();

    if (!currentUser) {
      console.error("❌ Current user not found:", currentUserId);
      return res.status(401).json({ message: "User not authenticated" });
    }

    const usersWithStatus = users.map((user) => {
      let friendStatus = "none";

      if (currentUser.friends?.some(id => id.toString() === user._id.toString())) {
        friendStatus = "friends";
      } else if (currentUser.sentFriendRequests?.some(id => id.toString() === user._id.toString())) {
        friendStatus = "request_sent";
      } else if (currentUser.receivedFriendRequests?.some(id => id.toString() === user._id.toString())) {
        friendStatus = "request_received";
      }

      return { ...user, friendStatus };
    });

    res.status(200).json(usersWithStatus);
  } catch (error) {
    console.error("❌ Search users error:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
};

// Get notifications
export const getNotifications = async (req, res) => {
  try {
    const userId = req.userid;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("fromUserId", "name handle")
      .lean();

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// Mark notifications as read
export const markNotificationsRead = async (req, res) => {
  try {
    const userId = req.userid;

    await Notification.updateMany({ userId, read: false }, { read: true });

    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    res.status(500).json({ message: "Failed to mark notifications as read" });
  }
};