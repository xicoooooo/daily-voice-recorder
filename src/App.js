import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Login from './login';
import DailyVoiceRecorder from './dailyVoiceRecorder';
import UserProfile from './userProfile';

function App() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser && !currentUser.emailVerified) {
                await signOut(auth);
                setError("Please verify your email before logging in.");
                setLoading(false);
                return;
            }

            setUser(currentUser);

            if (currentUser) {
                try {
                    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                    if (userDoc.exists()) {
                        setUserProfile(userDoc.data());

                        if (userDoc.data().emailVerified !== currentUser.emailVerified) {
                            await setDoc(doc(db, "users", currentUser.uid), {
                                ...userDoc.data(),
                                emailVerified: currentUser.emailVerified
                            }, { merge: true });
                        }
                    } else {
                        const defaultProfile = {
                            username: currentUser.email.split('@')[0],
                            email: currentUser.email,
                            emailVerified: currentUser.emailVerified,
                            createdAt: new Date()
                        };

                        await setDoc(doc(db, "users", currentUser.uid), defaultProfile);

                        // Also create username reference for uniqueness
                        await setDoc(doc(db, "usernames", defaultProfile.username.toLowerCase()), {
                            uid: currentUser.uid,
                            username: defaultProfile.username.toLowerCase()
                        });

                        setUserProfile(defaultProfile);
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                }
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const handleLogout = () => {
        signOut(auth);
        setUserProfile(null);
        setError('');
    };

    const updateUserProfile = (updatedProfile) => {
        setUserProfile(updatedProfile);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-100">
                <div className="animate-spin w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div>
            {user ? (
                <>
                    <div className="bg-white/70 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
                        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                    Daily Voice Recorder
                                </h1>
                                <p className="text-gray-600 mt-1">Speak your thoughts, capture your moments</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setShowProfileModal(true)}
                                    className="text-sm font-medium text-gray-700 hover:text-purple-600 transition-colors"
                                >
                                    {userProfile?.username || 'User'}
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>

                    {showProfileModal && (
                        <UserProfile
                            user={user}
                            userProfile={userProfile}
                            onClose={() => setShowProfileModal(false)}
                            updateProfileState={updateUserProfile}
                        />
                    )}

                    <DailyVoiceRecorder user={user} />
                </>
            ) : (
                <>
                    {error && (
                        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm px-4 py-3 shadow-lg">
                            {error}
                        </div>
                    )}
                    <Login />
                </>
            )}
        </div>
    );
}

export default App;