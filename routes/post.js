import express from "express";
import auth from "../middleware/auth.js";
import {
    createPost,
    getallposts,
    likePost,
    commentPost,
    sendFriendRequest,
    confirmFriendRequest,
    rejectFriendRequest,
    getFriends,
    getFriendRequests,
    getNotifications,
    markNotificationsRead,
    searchUsers,
    removeFriend,
    sharePost,
} from "../controller/post.js";

const router = express.Router();

router.post("/create", auth, createPost);
router.get("/getall", getallposts);
router.patch("/like/:id", auth, likePost);
router.post("/comment/:id", auth, commentPost);
router.patch("/share/:id", sharePost);

// Friend System
router.post("/friend/request", auth, sendFriendRequest);
router.post("/friend/confirm", auth, confirmFriendRequest);
router.post("/friend/reject", auth, rejectFriendRequest);
router.get("/friends", auth, getFriends);
router.get("/friend-requests", auth, getFriendRequests);
router.delete("/friend/:friendId", auth, removeFriend);

// Notifications
router.get("/notifications", auth, getNotifications);
router.patch("/notifications/read", auth, markNotificationsRead);

router.get("/search", auth, searchUsers);


// Temporary notification endpoints
router.get("/notifications", auth, async (req, res) => {
  try {
    // Return empty array for now
    res.status(200).json([]);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

router.patch("/notifications/read", auth, async (req, res) => {
  try {
    res.status(200).json({ message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark notifications" });
  }
});

export default router;
