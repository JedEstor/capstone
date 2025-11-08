import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { assets } from "../assets/assets";
import { useNavigate, useLocation } from "react-router-dom";

const LoginForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showForm, setShowForm] = useState(true);

  // Fixed owner credentials (for owner dashboard quick access)
  const OWNER_EMAIL = "owner@hotel.com";
  const OWNER_PASSWORD = "Owner@1234";

  // Signup states
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Login states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState(""); 

  // OTP states
  const [step, setStep] = useState(1); 
  const [userId, setUserId] = useState(null);
  const [otp, setOtp] = useState("");

  // Error state
  const [error, setError] = useState("");

  // Eye icon states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Catch token from Google callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const user = params.get("user");
    if (token && user) {
      try {
        const parsedUser = JSON.parse(decodeURIComponent(user));
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(parsedUser));
        alert("✅ Logged in with Google!");
        window.location.href = "/";
      } catch (err) {
        console.error("Error parsing Google user:", err);
      }
    }
  }, [location]);

  // Handle Signup
  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      const res = await fetch("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email: signupEmail,
          password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Signup success! Please login now.");
        setIsLogin(true);
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    }
  };

  // Handle Login (Step 1: request OTP)
  const handleLogin = async (e) => {
    e.preventDefault();
    // Fast-path: fixed owner credentials -> go directly to owner dashboard
    if (loginEmail === OWNER_EMAIL && loginPassword === OWNER_PASSWORD) {
      try {
        // Mark as owner via localStorage so RequireOwner allows access
        localStorage.setItem("owner", "true");
        // Optional: store a minimal user object for consistency
        const ownerUser = { email: OWNER_EMAIL, role: "hotelOwner", name: "Owner" };
        localStorage.setItem("user", JSON.stringify(ownerUser));
        // Optional: set a placeholder token
        localStorage.setItem("token", "owner-fixed-login");
        alert("✅ Logged in as Owner");
        navigate("/owner");
        return;
      } catch (err) {
        console.error(err);
        setError("Something went wrong");
        return;
      }
    }
    try {
      const res = await fetch("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("📧 OTP sent to your email");
        setUserId(data.user_id);
        setStep(2); // show OTP form
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    }
  };

  // Handle Verify OTP (Step 2: complete login)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:3000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, otp }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        alert("✅ Login successful!");
        navigate("/"); // redirect to homepage
      } else {
        setError(data.message);
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    }
  };

  if (!showForm) return null;

  return (
    <div className="relative flex h-[700px] w-full overflow-hidden bg-gray-50 rounded-xl shadow-lg">
      {/* Close Icon */}
      <img
        src={assets.closeIcon}
        alt="close-icon"
        className="absolute top-4 right-4 h-6 w-6 cursor-pointer z-30"
        onClick={() => setShowForm(false)}
      />

      {/* Sliding Image */}
      <motion.div
        className="absolute top-0 left-0 h-full w-1/2 z-20"
        initial={false}
        animate={{ x: isLogin ? "0%" : "100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        <img
          className="h-full w-full object-cover"
          src="https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/login/leftSideImage.png"
          alt="Slide Panel"
        />
      </motion.div>

      {/* Forms */}
      <div className="absolute inset-0 flex">
        {/* Sign Up */}
        <div className="hidden md:flex w-1/2 items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center justify-center w-full h-full">
            <h2 className="text-4xl font-medium text-gray-900">Sign up</h2>
            <p className="text-sm text-gray-500/90 mt-3">
              Create your account to get started
            </p>
            <form
              className="mt-8 w-80 flex flex-col gap-4"
              onSubmit={handleSignup}
            >
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="border border-gray-300 rounded-full px-4 py-2 outline-none"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className="border border-gray-300 rounded-full px-4 py-2 outline-none"
                required
              />

              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-gray-300 rounded-full px-4 py-2 outline-none w-full pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <img
                    src={showPassword ? assets.eyeOpen : assets.eyeClosed}
                    alt=""
                    className="h-5 w-5"
                  />
                </button>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border border-gray-300 rounded-full px-4 py-2 outline-none w-full pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <img
                    src={
                      showConfirmPassword ? assets.eyeOpen : assets.eyeClosed
                    }
                    alt=""
                    className="h-5 w-5"
                  />
                </button>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={
                  !password || !confirmPassword || password !== confirmPassword
                }
                className={`mt-4 w-full h-11 rounded-full text-white transition-opacity ${
                  !password || !confirmPassword || password !== confirmPassword
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-indigo-500 hover:opacity-90"
                }`}
              >
                Sign up
              </button>
              <p className="text-gray-500/90 text-sm mt-4 text-center">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-indigo-400 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          </div>
        </div>

        {/* Sign In */}
        <div className="w-full md:w-1/2 flex flex-col items-center justify-center">
          {step === 1 ? (
            // Step 1: email + password
            <form
              className="md:w-96 w-80 flex flex-col items-center justify-center"
              onSubmit={handleLogin}
            >
              <h2 className="text-4xl text-gray-900 font-medium">Sign in</h2>
              <p className="text-sm text-gray-500/90 mt-3">
                Welcome back! Please sign in to continue
              </p>

              {/* ✅ Google Login Button */}
              <a
                href="http://localhost:3000/api/auth/google"
                className="w-full"
              >
                <button
                  type="button"
                  className="w-full mt-6 bg-red-500 text-white px-6 py-2 rounded-full hover:bg-red-600 transition"
                >
                  Sign in with Google
                </button>
              </a>

              <div className="flex items-center gap-4 w-full my-5">
                <div className="w-full h-px bg-gray-300/90"></div>
                <p className="w-full text-nowrap text-sm text-gray-500/90">
                  or sign in with email
                </p>
                <div className="w-full h-px bg-gray-300/90"></div>
              </div>

              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 h-12 rounded-full border border-gray-300 outline-none text-sm text-gray-600"
                required
              />

              <div className="relative w-full mt-4">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 h-12 rounded-full border border-gray-300 outline-none text-sm text-gray-600 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <img
                    src={showLoginPassword ? assets.eyeOpen : assets.eyeClosed}
                    alt=""
                    className="h-5 w-5"
                  />
                </button>
              </div>

              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

              <button
                type="submit"
                className="mt-8 w-50 h-11 rounded-full text-white bg-indigo-500 hover:opacity-90 transition-opacity"
              >
                Login
              </button>

              <p className="text-gray-500/90 text-sm mt-4">
                Don’t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-indigo-400 hover:underline"
                >
                  Sign up
                </button>
              </p>
            </form>
          ) : (
            // Step 2: OTP input
            <form
              className="md:w-96 w-80 flex flex-col items-center justify-center"
              onSubmit={handleVerifyOtp}
            >
              <h2 className="text-2xl text-gray-900 font-medium">Enter OTP</h2>
              <p className="text-sm text-gray-500/90 mt-3">
                We’ve sent a 6-digit code to your email.
              </p>

              <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full mt-6 px-4 h-12 rounded-full border border-gray-300 outline-none text-sm text-gray-600 text-center"
                required
              />

              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

              <button
                type="submit"
                className="mt-6 w-50 h-11 rounded-full text-white bg-indigo-500 hover:opacity-90 transition-opacity"
              >
                Verify OTP
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginForm;