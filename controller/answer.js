import mongoose from "mongoose";
import question from "../models/question.js";
import user from "../models/auth.js";
import { awardBadges } from "./auth.js";

export const Askanswer = async (req, res) => {
  const { id: _id } = req.params;
  const userId = req.userid; // Use from auth middleware

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "question unavailable" });
  }

  if (!userId) return res.status(403).json({ message: "Unauthenticated" });

  const { noofanswer, answerbody, useranswered } = req.body;

  try {
    const userData = await user.findById(userId);
    if (!userData) return res.status(404).json({ message: "User not found" });

    // Rule: Need at least 1 friend to post answers
    const friendsCount = Array.isArray(userData.friends) ? userData.friends.length : 0;
    if (friendsCount === 0) {
      return res.status(403).json({ message: "You are not allowed to post answers. You need at least 1 friend to participate." });
    }

    await updatenoofanswer(_id, noofanswer);

    const updatequestion = await question.findByIdAndUpdate(_id, {
      $addToSet: { answer: [{ answerbody, useranswered, userid: userId }] },
    });

    if (!updatequestion) {
      console.error(`[ANSWER] Question not found for reply: ${_id}`);
      return res.status(404).json({ message: "Question not found" });
    }

    // Reward +5 points to the answer author
    try {
      await user.findByIdAndUpdate(userId, { $inc: { points: 5 } });
      await awardBadges(userId);
    } catch (e) {
      console.error(`[ANSWER] Failed to add points for user ${userId}:`, e?.message || e);
    }
    res.status(200).json({ data: updatequestion });
  } catch (error) {
    console.error(`[ANSWER] Error posting answer to question ${_id}:`, error);
    res.status(500).json({ message: "Something went wrong while posting your answer." });
    return;
  }
};

export const voteanswer = async (req, res) => {
  const { questionId } = req.params;
  const { answerId, value, userid } = req.body; // value: 'upvote' | 'downvote'
  if (!mongoose.Types.ObjectId.isValid(questionId)) {
    return res.status(400).json({ message: "question unavailable" });
  }
  if (!mongoose.Types.ObjectId.isValid(answerId)) {
    return res.status(400).json({ message: "answer unavailable" });
  }
  try {
    const qDoc = await question.findById(questionId);
    if (!qDoc) return res.status(404).json({ message: "question not found" });
    const ans = qDoc.answer.id(answerId);
    if (!ans) return res.status(404).json({ message: "answer not found" });

    const alreadyUp = ans.upvote.includes(String(userid));
    const alreadyDown = ans.downvote.includes(String(userid));

    let authorPointDelta = 0;

    if (value === "upvote") {
      // remove downvote if present
      if (alreadyDown) {
        ans.downvote = ans.downvote.filter((id) => id !== String(userid));
        authorPointDelta += 1; // removing previous downvote restores 1 point
      }
      if (alreadyUp) {
        // toggle off upvote
        ans.upvote = ans.upvote.filter((id) => id !== String(userid));
      } else {
        ans.upvote.push(String(userid));
      }
    } else if (value === "downvote") {
      // remove upvote if present
      if (alreadyUp) {
        ans.upvote = ans.upvote.filter((id) => id !== String(userid));
      }
      if (alreadyDown) {
        // toggle off downvote
        ans.downvote = ans.downvote.filter((id) => id !== String(userid));
        authorPointDelta += 1; // removing a downvote gives back 1
      } else {
        ans.downvote.push(String(userid));
        authorPointDelta -= 1; // new downvote costs 1
      }
    }

    // Special milestone: when upvotes reach exactly 5, award +5 (one-time on reaching 5)
    const upCount = ans.upvote.length;
    if (value === "upvote" && !alreadyUp && upCount === 5) {
      authorPointDelta += 5;
    }

    await qDoc.save();

    if (authorPointDelta !== 0 && ans.userid) {
      try {
        await user.findByIdAndUpdate(ans.userid, { $inc: { points: authorPointDelta } });
        await awardBadges(ans.userid);
      } catch (e) {
        console.log("Failed to adjust author points:", e?.message || e);
      }
    }

    res.status(200).json({ data: qDoc });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};
const updatenoofanswer = async (_id, noofanswer) => {
  try {
    await question.findByIdAndUpdate(_id, { $set: { noofanswer: noofanswer } });
  } catch (error) {
    console.log(error);
  }
};
export const deleteanswer = async (req, res) => {
  const { id: _id } = req.params;
  const { noofanswer, answerid } = req.body;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "question unavailable" });
  }
  if (!mongoose.Types.ObjectId.isValid(answerid)) {
    return res.status(400).json({ message: "answer unavailable" });
  }
  updatenoofanswer(_id, noofanswer);
  try {
    // Find answer owner to deduct points
    const qDoc = await question.findById(_id);
    const targetAns = qDoc?.answer?.find((a) => String(a._id) === String(answerid));
    const updatequestion = await question.updateOne(
      { _id },
      {
        $pull: { answer: { _id: answerid } },
      }
    );
    if (targetAns?.userid) {
      try {
        await user.findByIdAndUpdate(targetAns.userid, { $inc: { points: -5 } });
        await awardBadges(targetAns.userid);
      } catch (e) {
        console.log("Failed to deduct points:", e?.message || e);
      }
    }
    res.status(200).json({ data: updatequestion });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};
