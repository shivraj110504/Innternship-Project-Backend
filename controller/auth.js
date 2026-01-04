import mongoose from "mongoose";
import user from "../models/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
export const Signup = async (req, res) => {
  const { name, email, password } = req.body;
  console.log("Signup attempt for:", email);
  try {
    const exisitinguser = await user.findOne({ email });
    if (exisitinguser) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: "User already exist" });
    }
    console.log("Hashing password...");
    const hashpassword = await bcrypt.hash(password, 12);

    const countBefore = await user.countDocuments();
    console.log("User count before create:", countBefore);

    console.log("Creating user...");
    const newuser = await user.create({
      name,
      email,
      password: hashpassword,
    });

    const countAfter = await user.countDocuments();
    console.log("User count after create:", countAfter);
    console.log("Created user ID:", newuser._id);

    console.log("User created, generating token...");
    const token = jwt.sign(
      { email: newuser.email, id: newuser._id },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "1h" }
    );
    console.log("Signup successful for:", email);
    res.status(200).json({ data: newuser, token });
  } catch (error) {
    console.error("Signup Error Detail:", error);
    res.status(500).json({ message: error.message || "Something went wrong during signup" });
  }
};
export const Login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const exisitinguser = await user.findOne({ email });
    if (!exisitinguser) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const ispasswordcrct = await bcrypt.compare(
      password,
      exisitinguser.password
    );
    if (!ispasswordcrct) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const token = jwt.sign(
      { email: exisitinguser.email, id: exisitinguser._id },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "1h" }
    );
    res.status(200).json({ data: exisitinguser, token });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: error.message || "Something went wrong during login" });
  }
};
export const getallusers = async (req, res) => {
  try {
    const alluser = await user.find();
    res.status(200).json({ data: alluser });
  } catch (error) {
    res.status(500).json("something went wrong..");
    return;
  }
};
export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { name, about, tags } = req.body.editForm;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "User unavailable" });
  }
  try {
    const updateprofile = await user.findByIdAndUpdate(
      _id,
      { $set: { name: name, about: about, tags: tags } },
      { new: true }
    );
    res.status(200).json({ data: updateprofile });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};
