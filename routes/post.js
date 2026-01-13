import express from "express";
import auth from "../middleware/auth.js";
import {
    createPost,
    getallposts,
    likePost,
    commentPost,
    followUser,
    searchUsers,
} from "../controller/post.js";

const router = express.Router();

router.post("/create", auth, createPost);
router.get("/getall", getallposts);
router.patch("/like/:id", auth, likePost);
router.post("/comment/:id", auth, commentPost);
router.post("/follow", auth, followUser);
router.get("/search", searchUsers);

export default router;
