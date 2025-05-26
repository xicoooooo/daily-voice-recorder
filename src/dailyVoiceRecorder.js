import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Save, Calendar, Clock, Trash2, Globe } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

const DailyVoiceRecorder = ({ user }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [entryTitle, setEntryTitle] = useState('');
  const recognitionRef = useRef(null);
  const [language, setLanguage] = useState('en-US');
  const [translateTo, setTranslateTo] = useState({});
  const [translating, setTranslating] = useState({});
  const [translatedEntries, setTranslatedEntries] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEntries = async () => {
      if (!user) return;

      setLoading(true);
      try {
        const q = query(collection(db, "entries"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);

        const loadedEntries = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate()
        }));

        setEntries(loadedEntries.sort((a, b) => b.timestamp - a.timestamp));
      } catch (error) {
        setError(`Error loading entries: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadEntries();
  }, [user]);

  const improveCapitalization = (text) => {
    let improved = text.charAt(0).toUpperCase() + text.slice(1);

    improved = improved.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => {
      return p1 + p2.toUpperCase();
    });

    return improved;
  };

  const languageOptions = [
    { code: 'en-US', name: 'English' },
    { code: 'pt-PT', name: 'Portuguese' },
    { code: 'es-ES', name: 'Spanish' },
    { code: 'fr-FR', name: 'French' },
    { code: 'de-DE', name: 'German' },
    { code: 'it-IT', name: 'Italian' }
  ];

  const handleLanguageChange = (newLanguage) => {
    if (language === newLanguage) return;

    if (finalTranscript.trim() || interimTranscript.trim()) {
      if (window.confirm('You have unsaved content. Do you want to save it before changing languages?')) {
        saveEntry();
      } else if (!window.confirm('Changing languages will clear your current transcript. Continue?')) {
        return;
      }
    }

    setFinalTranscript('');
    setInterimTranscript('');
    setLanguage(newLanguage);
  };

  const translateEntry = async (entryId, targetLang) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    setTranslating(prev => ({ ...prev, [entryId]: true }));

    try {
      const sourceLang = language.split('-')[0];
      const targetShortLang = targetLang.split('-')[0];

      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(entry.text)}&langpair=${sourceLang}|${targetShortLang}`);
      const data = await response.json();

      if (data.responseData) {
        setTranslatedEntries(prev => ({
          ...prev,
          [entryId]: {
            lang: targetLang,
            text: data.responseData.translatedText
          }
        }));
      } else {
        setError(`Translation error: ${data.responseStatus}`);
      }
    } catch (error) {
      setError(`Translation failed: ${error.message}`);
    } finally {
      setTranslating(prev => ({ ...prev, [entryId]: false }));
    }
  };

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let currentInterim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          let improved = improveCapitalization(transcript);

          if (!/[.!?]$/.test(improved)) {
            improved += '.';
          }

          setFinalTranscript(prev => prev + improved + ' ');
          setInterimTranscript('');
        } else {
          currentInterim += transcript;
        }
      }

      if (currentInterim) {
        setInterimTranscript(currentInterim);
      }
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language]);

  const startRecording = () => {
    if (!recognitionRef.current) return;

    setError('');
    setFinalTranscript('');
    setInterimTranscript('');
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopRecording = () => {
    if (!recognitionRef.current) return;

    setIsRecording(false);
    recognitionRef.current.stop();
  };

  const saveEntry = async () => {
    const fullTranscript = finalTranscript.trim();
    if (!fullTranscript) {
      setError('Please record something before saving.');
      return;
    }

    const title = entryTitle.trim() || `Journal Entry ${new Date().toLocaleDateString()}`;

    try {
      const newEntry = {
        title: title,
        text: fullTranscript,
        timestamp: new Date(),
        language: language,
        userId: user.uid,
      };

      const docRef = await addDoc(collection(db, "entries"), newEntry);

      setEntries(prev => [{...newEntry, id: docRef.id}, ...prev]);
      setFinalTranscript('');
      setInterimTranscript('');
      setEntryTitle('');
      setError('');
    } catch (error) {
      setError(`Failed to save entry: ${error.message}`);
    }
  };

  const deleteEntry = async (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteDoc(doc(db, "entries", id));
        setEntries(prev => prev.filter(entry => entry.id !== id));

        setTranslatedEntries(prev => {
          const updated = {...prev};
          delete updated[id];
          return updated;
        });
      } catch (error) {
        setError(`Failed to delete entry: ${error.message}`);
      }
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-100">
        {/* Header is now moved to dailyVoiceRecorder.js */}

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          {/* Language Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              Recognition Language
            </label>
            <div className="flex flex-wrap gap-2 justify-center">
              {languageOptions.map((option) => (
                  <button
                      key={option.code}
                      onClick={() => handleLanguageChange(option.code)}
                      disabled={isRecording}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          language === option.code
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'bg-white text-gray-700 hover:bg-purple-100 border border-gray-200'
                      }`}
                  >
                    {option.name}
                  </button>
              ))}
            </div>
          </div>

          {/* Loading indicator */}
          {loading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full"></div>
              </div>
          )}

          {/* Recording Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording
                        ? 'bg-red-100 ring-4 ring-red-200 animate-pulse'
                        : 'bg-purple-100 hover:bg-purple-200'
                }`}>
                  {isRecording ? (
                      <MicOff className="w-10 h-10 text-red-600" />
                  ) : (
                      <Mic className="w-10 h-10 text-purple-600" />
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-center gap-4">
                  {!isRecording ? (
                      <button
                          onClick={startRecording}
                          disabled={!!error}
                          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                      >
                        Start Recording
                      </button>
                  ) : (
                      <button
                          onClick={stopRecording}
                          className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
                      >
                        Stop Recording
                      </button>
                  )}
                </div>

                {isRecording && (
                    <div className="text-red-600 font-medium flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      Recording...
                    </div>
                )}
              </div>
            </div>

            {/* Transcript Display */}
            {(finalTranscript || interimTranscript) && (
                <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Voice:</h3>
                  <p className="text-gray-700 leading-relaxed min-h-[60px]">
                    {finalTranscript}
                    <span className="text-blue-500 font-medium">{interimTranscript}</span>
                  </p>

                  {finalTranscript && (
                      <div className="mt-6 space-y-4">
                        <div>
                          <label htmlFor="entry-title" className="block text-sm font-medium text-gray-700 mb-1">
                            Entry Title (optional):
                          </label>
                          <input
                              type="text"
                              id="entry-title"
                              value={entryTitle}
                              onChange={(e) => setEntryTitle(e.target.value)}
                              placeholder="Give your entry a title..."
                              className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors duration-200"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                              onClick={saveEntry}
                              className="px-6 py-2 bg-green-500 text-white rounded-full font-medium hover:bg-green-600 transition-colors duration-200 flex items-center gap-2 shadow-md"
                          >
                            <Save className="w-4 h-4" />
                            Save Entry
                          </button>
                        </div>
                      </div>
                  )}
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <p className="text-red-700">{error}</p>
                </div>
            )}
          </div>

          {/* Records Entries */}
          {entries.length > 0 && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-purple-600" />
                  Your Record Entries
                </h2>

                <div className="space-y-4">
                  {entries.map((entry) => (
                      <div
                          key={entry.id}
                          className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-shadow duration-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-purple-700">{entry.title}</h3>
                          <button
                              onClick={() => deleteEntry(entry.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors duration-200"
                              title="Delete entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            {formatDate(entry.timestamp)}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Clock className="w-4 h-4" />
                            {formatTime(entry.timestamp)}
                          </div>
                        </div>
                        <p className="text-gray-700 leading-relaxed">{entry.text}</p>

                        {/* Translation UI */}
                        <div className="mt-4 border-t border-gray-100 pt-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-600" />
                            <label className="text-sm text-gray-600">Translate to:</label>
                            <select
                                value={translateTo[entry.id] || ""}
                                onChange={(e) => setTranslateTo({...translateTo, [entry.id]: e.target.value})}
                                className="text-sm border border-gray-200 rounded px-2 py-1"
                                disabled={translating[entry.id]}
                            >
                              <option value="">Select language</option>
                              {languageOptions
                                  .filter(opt => opt.code !== entry.language)
                                  .map(opt => (
                                      <option key={opt.code} value={opt.code}>{opt.name}</option>
                                  ))}
                            </select>
                            <button
                                onClick={() => translateEntry(entry.id, translateTo[entry.id])}
                                disabled={!translateTo[entry.id] || translating[entry.id]}
                                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                            >
                              {translating[entry.id] ? 'Translating...' : 'Translate'}
                            </button>
                          </div>

                          {translatedEntries[entry.id] && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                                <p className="text-sm font-medium text-blue-800 mb-1">
                                  Translation ({languageOptions.find(opt => opt.code === translatedEntries[entry.id].lang)?.name}):
                                </p>
                                <p className="text-gray-700">{translatedEntries[entry.id].text}</p>
                              </div>
                          )}
                        </div>
                      </div>
                  ))}
                </div>
              </div>
          )}

          {/* Empty State */}
          {entries.length === 0 && !finalTranscript && !interimTranscript && !isRecording && !loading && (
              <div className="text-center py-16">
                <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
                  <Mic className="w-16 h-16 text-purple-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-600 mb-2">Ready to start recording?</h3>
                <p className="text-gray-500">Click the record button above to begin capturing your thoughts with your voice.</p>
              </div>
          )}
        </div>
      </div>
  );
};

export default DailyVoiceRecorder;