import Organization from "../models/Organization.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registerUser = async ({
  name,
  email,
  password,
  role,
  phone,
  gstNumber,
}) => {
  // 1️⃣ Check if email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new Error("User already exists");

  // 2️⃣ Create organization
  const organization = await Organization.create({
    name: `${name}'s Business`,
    gstNumber,
  });

  // 3️⃣ Hash password
  const hash = await bcrypt.hash(password, 10);

  // 4️⃣ Create user with organizationId
  const user = await User.create({
    name,
    email,
    passwordHash: hash,
    role,
    organizationId: organization._id, // ✅ THIS IS THE KEY
    phone,
    gstNumber,
  });
  await seedLedgerAccountsForHotel(organization._id, user._id);

  // 5️⃣ Generate token
  const token = jwt.sign(
    {
      id: user._id,
      organizationId: organization._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

  const userObj = user.toObject();
  delete userObj.passwordHash;

  return { user: userObj, token };
};
export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email });
  console.log("test", user);
  if (!user) throw new Error("Invalid credentials");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error("Invalid credentials");
  const token = jwt.sign(
    { id: user._id, organizationId: user.organizationId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
  return { user, token };
};
