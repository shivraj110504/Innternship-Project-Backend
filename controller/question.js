import mongoose from "mongoose";
import question from "../models/question.js";
import User from "../models/auth.js";


export const Askquestion = async (req, res) => {
  const { postquestiondata } = req.body;
  const userId = req.userid;

  if (!userId) return res.status(403).json({ message: "Unauthenticated" });

  try {
    const userData = await User.findById(userId);
    if (!userData) {
      console.error(`[POST] User not found: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    // Use 'friends' array (replaced followers/following)
    const friendsCount = Array.isArray(userData.friends) ? userData.friends.length : 0;
    console.log(`[POST] User ${userId} has ${friendsCount} friends. Friends array:`, userData.friends);

    // Rule: if no friends, cannot post
    if (friendsCount === 0) {
      return res.status(403).json({ message: "You are not allowed to post. You need at least 1 friend to ask questions." });
    }

    // Rule: Posting limit logic based on friends count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const questionsToday = await question.countDocuments({
      userid: userId,
      askedon: { $gte: today },
    });

    // 1 friend = 1 post/day, 2 friends = 2 posts/day, >10 friends = unlimited
    if (friendsCount >= 1 && friendsCount <= 10) {
      if (questionsToday >= friendsCount) {
        return res.status(429).json({
          message: `You can post only ${friendsCount} question${friendsCount > 1 ? "s" : ""} a day based on your friends count.`,
        });
      }
    }
    // If friendsCount > 10, no limit (multiple times)

    const postques = new question({ ...postquestiondata, userid: userId });
    await postques.save();
    res.status(200).json({ data: postques });
  } catch (error) {
    console.error("Ask question error:", error);
    res.status(500).json({ message: error.message || "Something went wrong" });
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
