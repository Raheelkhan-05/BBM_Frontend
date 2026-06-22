// frontend/api/auth.js
// Replaces the old password-based loginUser / signupUser helpers.

import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});

// ── Signup: register profile + triggers first OTP send ───────────────────
export const signupUser = ({ email, first_name, last_name, phone }) =>
  API.post("/api/auth/signup", { email, first_name, last_name, phone })
    .then((r) => r.data);

// ── Login step 1: request OTP for an existing account ────────────────────
export const sendOtp = (email) =>
  API.post("/api/auth/send-otp", { email }).then((r) => r.data);

// ── Login step 2: verify the 6-digit code → returns { token, user } ──────
export const verifyOtp = (email, token) =>
  API.post("/api/auth/verify-otp", { email, token }).then((r) => r.data);