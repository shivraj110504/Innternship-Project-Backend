// routes/posts.js

import express from "express";
import auth from "../middleware/auth.js";
import {
  createPost,
  getAllPosts,
  getPost,
  likePost,
  commentPost,
  sharePost,
  deletePost,
  getUserPosts,
  getPostingStats,
  sendFriendRequest,
  confirmFriendRequest,
  rejectFriendRequest,
  getFriends,
  getFriendRequests,
  removeFriend,
  searchUsers,
  getNotifications,
  markNotificationsRead,
} from "../controller/post.js";

const router = express.Router();

// IMPORTANT: Specific routes BEFORE dynamic routes!

// Search routes
router.get("/search", auth, searchUsers);

// Friend routes
router.post("/friend/request", auth, sendFriendRequest);
router.post("/friend/confirm", auth, confirmFriendRequest);
router.post("/friend/reject", auth, rejectFriendRequest);
router.get("/friends", auth, getFriends);
router.get("/friend-requests", auth, getFriendRequests);
router.delete("/friend/:friendId", auth, removeFriend);

// Notification routes (MUST be before /:id)
router.get("/notifications", auth, getNotifications);
router.patch("/notifications/read", auth, markNotificationsRead);

// Post routes
router.post("/create", auth, createPost);
router.get("/getall", getAllPosts);
router.get("/user/:userId", getUserPosts);
router.get("/stats", auth, getPostingStats); // NEW: Get posting stats

// Dynamic routes LAST (these will match anything)
router.get("/:id", getPost);
router.patch("/like/:id", auth, likePost);
router.post("/comment/:id", auth, commentPost);
router.patch("/share/:id", auth, sharePost);
router.delete("/:id", auth, deletePost);

export default router;