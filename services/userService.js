// services/userService.js
import User from "../models/User.js";
import bcrypt from "bcryptjs";

/**
 * Auto-generate password based on email prefix
 * example email: "sahil@gmail.com"
 * password = "Sahil@123"
 */
export const generatePasswordFromEmail = (email) => {
  const prefix = email.split("@")[0];      // sahil
  const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1); // Sahil
  return `${capitalized}@123`;
};

/**
 * Create user (used by MD/GM)
 * Auto-generates password based on email
 */
export const createDepartmentUser = async (organizationId, payload) => {
  const { name, email, role } = payload;

  // check existing
  const existing = await User.findOne({ organizationId, email });
  if (existing) throw new Error("User with this email already exists.");

  // generate password
  const rawPassword = generatePasswordFromEmail(email);
  const hash = await bcrypt.hash(rawPassword, 10);

  const user = await User.create({
    organizationId,
    name,
    email,
    role,
    passwordHash: hash,
  });

  return { user, rawPassword };
};

/**
 * List all users for a Organization
 */
export const listUsers = async (organizationId) => {
  return User.find({ organizationId }).select("-passwordHash");
};

/**
 * Get a user by ID
 */
export const getUser = async (id) => {
  return User.findById(id).select("-passwordHash");
};

/**
 * Update user role or name
 */
export const updateUser = async (id, payload) => {
  return User.findByIdAndUpdate(id, payload, { new: true }).select("-passwordHash");
};

/**
 * Soft delete user (mark inactive)
 */
export const deleteUser = async (id) => {
  return User.findByIdAndUpdate(id, { isActive: false }, { new: true });
};
