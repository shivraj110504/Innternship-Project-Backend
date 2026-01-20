// Replace the Signup function in server/controller/auth.js

export const Signup = async (req, res) => {
  let { name, email, password, phone, handle } = req.body;
  console.log("Signup attempt for:", email);
  try {
    const exisitinguser = await user.findOne({ email });
    if (exisitinguser) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: "User already exist" });
    }
    
    // normalize phone to digits only if provided
    if (phone) {
      phone = String(phone).replace(/\D/g, "");
      if (phone.length < 10) {
        return res.status(400).json({ message: "Invalid phone number" });
      }
      const phoneExists = await user.findOne({ phone });
      if (phoneExists) {
        return res.status(400).json({ message: "Phone number already in use" });
      }
    }

    // Generate unique handle if not provided
    if (!handle) {
      let baseHandle = name.toLowerCase().replace(/\s+/g, "");
      handle = baseHandle;
      let counter = 1;
      
      // Check if handle exists, if so add number
      while (await user.findOne({ handle })) {
        handle = `${baseHandle}${counter}`;
        counter++;
      }
    } else {
      // Verify provided handle is unique
      const handleExists = await user.findOne({ handle });
      if (handleExists) {
        return res.status(400).json({ message: "Handle already in use" });
      }
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
      handle, // Always set handle
      ...(phone ? { phone } : {}),
      friends: [],
      sentFriendRequests: [],
      receivedFriendRequests: [],
      goldBadges: 0,
      silverBadges: 0,
      bronzeBadges: 0,
    });

    const countAfter = await user.countDocuments();
    console.log("User count after create:", countAfter);
    console.log("Created user ID:", newuser._id, "with handle:", handle);

    console.log("User created, generating token...");
    const token = jwt.sign(
      { email: newuser.email, id: newuser._id },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "36500d" }
    );

    // Record signup as first login
    await recordLoginHistory(req, newuser._id, "PASSWORD", "SUCCESS");

    console.log("Signup successful for:", email);
    res.setHeader('Set-Cookie', `token=${token}; HttpOnly; Path=/; Max-Age=3153600000; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    res.status(200).json({ data: newuser });
  } catch (error) {
    console.error("Signup Error Detail:", error);
    res.status(500).json({ message: error.message || "Something went wrong during signup" });
  }
};