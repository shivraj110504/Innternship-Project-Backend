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
} from "../controller/post.js";

const router = express.Router();

router.post("/create", auth, createPost);
router.get("/getall", getallposts);
router.patch("/like/:id", auth, likePost);
router.post("/comment/:id", auth, commentPost);

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

export default router;
