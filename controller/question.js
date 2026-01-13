import mongoose from "mongoose";
import question from "../models/question.js";
import User from "../models/auth.js";


export const Askquestion = async (req, res) => {
  const { postquestiondata } = req.body;
  const userId = req.userid;

  if (!userId) return res.status(403).json({ message: "Unauthenticated" });

  try {
    const userData = await User.findById(userId);
    if (!userData) return res.status(404).json({ message: "User not found" });

    const followerCount = userData.followers ? userData.followers.length : 0;

    // Rule: if no followers (friends), cannot post
    if (followerCount === 0) {
      return res.status(403).json({ message: "You cannot post any questions until you have followers (friends)." });
    }

    // Rule: Posting limit logic
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const questionsToday = await question.countDocuments({
      userid: userId,
      askedon: { $gte: today },
    });

    if (followerCount >= 1 && followerCount <= 10) {
      if (questionsToday >= followerCount) {
        return res.status(429).json({
          message: `You can post only ${followerCount} question${followerCount > 1 ? "s" : ""} a day based on your follower count.`,
        });
      }
    }
    // If followerCount > 10, no limit (multiple times)

    const postques = new question({ ...postquestiondata, userid: userId });
    await postques.save();
    res.status(200).json({ data: postques });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};

export const getallquestion = async (req, res) => {
  try {
    const allquestion = await question.find().sort({ askedon: -1 });
    res.status(200).json({ data: allquestion });
  } catch (error) {
    res.status(500).json("something went wrong..");
    return;
  }
};
export const deletequestion = async (req, res) => {
  const { id: _id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "question unavailable" });
  }
  try {
    await question.findByIdAndDelete(_id);
    res.status(200).json({ message: "question deleted" });
  } catch (error) {
    res.status(500).json("something went wrong..");
    return;
  }
};
export const votequestion = async (req, res) => {
  const { id: _id } = req.params;
  const { value, userid } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "question unavailable" });
  }
  try {
    const questionDoc = await question.findById(_id);
    const upindex = questionDoc.upvote.findIndex((id) => id === String(userid));
    const downindex = questionDoc.downvote.findIndex(
      (id) => id === String(userid)
    );
    if (value === "upvote") {
      if (downindex !== -1) {
        questionDoc.downvote = questionDoc.downvote.filter(
          (id) => id !== String(userid)
        );
      }
      if (upindex === -1) {
        questionDoc.upvote.push(userid);
      } else {
        questionDoc.upvote = questionDoc.upvote.filter((id) => id !== String(userid));
      }
    } else if (value === "downvote") {
      if (upindex !== -1) {
        questionDoc.upvote = questionDoc.upvote.filter((id) => id !== String(userid));
      }
      if (downindex === -1) {
        questionDoc.downvote.push(userid);
      } else {
        questionDoc.downvote = questionDoc.downvote.filter(
          (id) => id !== String(userid)
        );
      }
    }
    const questionvote = await question.findByIdAndUpdate(_id, questionDoc, { new: true });
    res.status(200).json({ data: questionvote });
  } catch (error) {
    res.status(500).json("something went wrong..");
    return;
  }
};
