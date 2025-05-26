import React, { useState } from 'react';
import {
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from 'firebase/auth';
import {
    doc,
    updateDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

const UserProfile = ({ user, userProfile, onClose, updateProfileState }) => {
    const [username, setUsername] = useState(userProfile?.username || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');

    const checkUsernameAvailability = async (newUsername) => {
        if (newUsername === userProfile.username) return true;

        const usernamesRef = collection(db, "usernames");
        const q = query(usernamesRef, where("username", "==", newUsername.toLowerCase()));
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
    };

    const handleUsernameUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (!username.trim() || username.length < 3) {
                throw new Error("Username must be at least 3 characters long");
            }

            const isAvailable = await checkUsernameAvailability(username);
            if (!isAvailable) {
                throw new Error("Username is already taken");
            }

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { username: username });

            if (userProfile.username && userProfile.username !== username) {
                await deleteDoc(doc(db, "usernames", userProfile.username.toLowerCase()));
            }

            await setDoc(doc(db, "usernames", username.toLowerCase()), {
                uid: user.uid,
                username: username.toLowerCase()
            });

            setSuccess("Username updated successfully");
            updateProfileState({ ...userProfile, username });
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (newPassword.length < 6) {
                throw new Error("Password must be at least 6 characters long");
            }

            if (newPassword !== confirmPassword) {
                throw new Error("Passwords do not match");
            }

            const credential = EmailAuthProvider.credential(
                user.email,
                currentPassword
            );

            await reauthenticateWithCredential(user, credential);

            await updatePassword(user, newPassword);

            setSuccess("Password updated successfully");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            setError(
                error.code === 'auth/wrong-password'
                    ? "Current password is incorrect"
                    : error.message
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-800/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">Profile Settings</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            ✕
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                            {success}
                        </div>
                    )}

                    <div className="flex border-b mb-6">
                        <button
                            className={`px-4 py-2 font-medium ${activeTab === 'profile' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
                            onClick={() => setActiveTab('profile')}
                        >
                            Profile
                        </button>
                        <button
                            className={`px-4 py-2 font-medium ${activeTab === 'security' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
                            onClick={() => setActiveTab('security')}
                        >
                            Security
                        </button>
                    </div>

                    {activeTab === 'profile' ? (
                        <form onSubmit={handleUsernameUpdate}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    This is how other users will see you
                                </p>
                            </div>

                            <div className="mb-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={user.email}
                                    disabled
                                    className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-lg text-gray-500"
                                />
                            </div>

                            <div className="mt-6">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 shadow-md disabled:opacity-70"
                                >
                                    {loading ? 'Updating...' : 'Update Profile'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordUpdate}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Current Password
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div className="mt-6">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 shadow-md disabled:opacity-70"
                                >
                                    {loading ? 'Updating...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfile;