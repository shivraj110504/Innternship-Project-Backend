// controller/question.js

import question from "../models/question.js";
import mongoose from "mongoose";
import { incrementQuestionCount } from "./subscription.js";

// Post a new question (with subscription check)
export const askquestion = async (req, res) => {
  const postquestiondata = req.body.postquestiondata;
  const postquestion = new question(postquestiondata);

  try {
    // Increment question count for subscription tracking
    if (req.userid) {
      await incrementQuestionCount(req.userid);
    }

    await postquestion.save();
    res.status(200).json({ message: "Question posted successfully", data: postquestion });
  } catch (error) {
    console.log(error);
    res.status(409).json({ message: "Couldn't post a new Question" });
  }
};

// Get all questions - FIXED: Return consistent format
export const getallquestions = async (req, res) => {
  try {
    const questionlist = await question.find().sort({ askedon: -1 });
    
    console.log(`📋 Fetched ${questionlist.length} questions`);
    
    // Return in consistent format with data wrapper
    res.status(200).json({
      success: true,
      data: questionlist,
      count: questionlist.length
    });
  } catch (error) {
    console.error("❌ Error fetching questions:", error);
    res.status(404).json({ 
      success: false,
      message: error.message,
      data: [] // Always return empty array on error
    });
  }
};

// Delete a question
export const deletequestion = async (req, res) => {
  const { id: _id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "Question unavailable" });
  }
  try {
    await question.findByIdAndDelete(_id);
    res.status(200).json({ message: "Question deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: error.message });
  }
};

// Vote on a question
export const votequestion = async (req, res) => {
  const { id: _id } = req.params;
  const { value } = req.body;
  const userid = req.userid;

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "Question unavailable" });
  }

  try {
    const ques = await question.findById(_id);
    
    if (!ques) {
      return res.status(404).json({ message: "Question not found" });
    }

    const upIndex = ques.upvote.findIndex((id) => id === String(userid));
    const downIndex = ques.downvote.findIndex((id) => id === String(userid));

    if (value === "upvote") {
      if (downIndex !== -1) {
        ques.downvote = ques.downvote.filter((id) => id !== String(userid));
      }
      if (upIndex === -1) {
        ques.upvote.push(userid);
      } else {
        ques.upvote = ques.upvote.filter((id) => id !== String(userid));
      }
    } else if (value === "downvote") {
      if (upIndex !== -1) {
        ques.upvote = ques.upvote.filter((id) => id !== String(userid));
      }
      if (downIndex === -1) {
        ques.downvote.push(userid);
      } else {
        ques.downvote = ques.downvote.filter((id) => id !== String(userid));
      }
    }

    await question.findByIdAndUpdate(_id, ques);
    res.status(200).json({ message: "Voted successfully", data: ques });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: "Error in voting" });
  }
}