import express from "express";
import auth, { optionalAuth } from "../middleware/auth.js";
import {
    createPost,
    getallposts,
    likePost,
    commentPost,
    followUser,
    sendFriendRequest,
    confirmFriendRequest,
    rejectFriendRequest,
    searchUsers,
    getFollowers,
    getFriends,
    getFriendRequests,
    removeFollower,
} from "../controller/post.js";

const router = express.Router();

router.post("/create", auth, createPost);
router.get("/getall", getallposts);
router.patch("/like/:id", auth, likePost);
router.post("/comment/:id", auth, commentPost);
router.post("/follow", auth, followUser); // Backward compatibility - maps to sendFriendRequest
router.post("/friend/request", auth, sendFriendRequest);
router.post("/friend/confirm", auth, confirmFriendRequest);
router.post("/friend/reject", auth, rejectFriendRequest);
router.get("/search", optionalAuth, searchUsers); // Optional auth for friend status
router.get("/followers", auth, getFollowers); // Backward compatibility - maps to getFriends
router.get("/friends", auth, getFriends);
router.get("/friend-requests", auth, getFriendRequests);
router.delete("/follower/:followerId", auth, removeFollower);

export default router;
