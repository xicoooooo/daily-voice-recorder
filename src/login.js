import React, { useState } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { setDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const checkUsernameAvailability = async (username) => {
        const usernamesRef = collection(db, "usernames");
        const q = query(usernamesRef, where("username", "==", username.toLowerCase()));
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
    };

    const resendVerificationEmail = async () => {
        if (!email) {
            setError("Please enter your email address first");
            return;
        }

        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(userCredential.user);
            setSuccess("Verification email sent! Please check your inbox.");

            await signOut(auth);
        } catch (error) {
            setError("Couldn't send verification email. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (isSignUp) {
                if (!username.trim() || username.length < 3) {
                    throw new Error("Username must be at least 3 characters long");
                }

                const isAvailable = await checkUsernameAvailability(username);
                if (!isAvailable) {
                    throw new Error("Username is already taken");
                }

                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                await sendEmailVerification(userCredential.user);

                await setDoc(doc(db, "users", userCredential.user.uid), {
                    username: username,
                    email: email,
                    emailVerified: false,
                    createdAt: new Date()
                });

                await setDoc(doc(db, "usernames", username.toLowerCase()), {
                    uid: userCredential.user.uid,
                    username: username.toLowerCase()
                });

                setSuccess("Verification email sent! Please check your inbox and verify your email before logging in.");
            } else {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);

                if (!userCredential.user.emailVerified) {
                    await sendEmailVerification(userCredential.user);
                    throw new Error("Please verify your email before logging in. A new verification email has been sent.");
                }
            }
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-100">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 w-full max-w-md">
                <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                        {error.includes("verify your email") && (
                            <button
                                onClick={resendVerificationEmail}
                                className="ml-2 text-blue-600 hover:text-blue-800 underline"
                            >
                                Resend verification email
                            </button>
                        )}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                        {success}
                    </div>
                )}

                <form onSubmit={handleAuth}>
                    {isSignUp && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="username">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                required
                            />
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 shadow-md disabled:opacity-70"
                    >
                        {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    <button
                        onClick={() => {
                            setIsSignUp(!isSignUp);
                            setError('');
                            setSuccess('');
                        }}
                        className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                    >
                        {isSignUp ? 'Already have an account? Log in' : 'Need an account? Sign up'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;