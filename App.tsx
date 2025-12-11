import React from 'react';
import HandPuppet from './components/HandPuppet';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col text-gray-100 font-sans">
        {/* Header */}
        <header className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center shadow-md z-20 h-16 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">Hand Puppet Physics</h1>
            <p className="text-xs text-gray-400">
              Use your hand to control the puppet. Drag emojis or click to change face.
            </p>
          </div>
          <div className="hidden sm:block text-xs text-gray-500">
            Powered by ml5.js & p5play
          </div>
        </header>

        {/* Main Content (fills remaining height) */}
        <main className="flex-1 relative overflow-hidden">
          <HandPuppet />
        </main>
    </div>
  );
};

export default App;