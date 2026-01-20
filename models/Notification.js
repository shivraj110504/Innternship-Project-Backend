// Training/stackoverflow/server/models/Notification.js

import mongoose from "mongoose";

const notificationSchema = mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  type: { 
    type: String, 
    enum: ["LIKE", "COMMENT", "FRIEND_REQUEST", "FRIEND_ACCEPT", "FRIEND_REJECT"], 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  fromUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User" 
  },
  relatedId: { 
    type: mongoose.Schema.Types.ObjectId 
  },
  read: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

// Index for faster queries
notificationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);