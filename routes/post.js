import express from "express";
import auth from "../middleware/auth.js";
import {
    createPost,
    getallposts,
    likePost,
    commentPost,
    addFriend,
} from "../controller/post.js";

const router = express.Router();

router.post("/create", auth, createPost);
router.get("/getall", getallposts);
router.patch("/like/:id", auth, likePost);
router.post("/comment/:id", auth, commentPost);
router.post("/add-friend", auth, addFriend);

export default router;
