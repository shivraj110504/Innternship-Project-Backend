// Training/stackoverflow/server/routes/posts.js

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

// Post routes
router.post("/create", auth, createPost);
router.get("/getall", getAllPosts);
router.get("/:id", getPost);
router.patch("/like/:id", auth, likePost);
router.post("/comment/:id", auth, commentPost);
router.patch("/share/:id", auth, sharePost);
router.delete("/:id", auth, deletePost);
router.get("/user/:userId", getUserPosts);

// Friend routes
router.post("/friend/request", auth, sendFriendRequest);
router.post("/friend/confirm", auth, confirmFriendRequest);
router.post("/friend/reject", auth, rejectFriendRequest);
router.get("/friends", auth, getFriends);
router.get("/friend-requests", auth, getFriendRequests);
router.delete("/friend/:friendId", auth, removeFriend);

// Search routes
router.get("/search", auth, searchUsers);

// Notification routes
router.get("/notifications", auth, getNotifications);
router.patch("/notifications/read", auth, markNotificationsRead);

export default router;