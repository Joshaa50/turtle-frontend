
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

const AIConsultant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: 'You are an expert marine biologist and turtle conservation researcher for Archelon (The Sea Turtle Protection Society of Greece). You provide accurate, scientific data and guidance on Loggerhead and Green turtle conservation, nesting protocols, and field data analysis. Keep responses professional, helpful, and concise.',
        },
      });

      const aiText = response.text || "I'm sorry, I couldn't process that. Please try again.";
      setMessages(prev => [...prev, { role: 'ai', text: aiText }]);
    } catch (error) {
      console.error('Gemini Error:', error);
      setMessages(prev => [...prev, { role: 'ai', text: "Technical error connecting to the research cloud. Please check your connection." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
      {isOpen && (
        <div className="w-80 h-[500px] bg-[#111821]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <header className="p-4 bg-primary text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">psychology</span>
              <span className="text-sm font-black uppercase tracking-widest">Research AI</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="material-symbols-outlined text-lg hover:bg-white/10 rounded">close</button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-50">
                <span className="material-symbols-outlined text-4xl">science</span>
                <p className="text-xs font-bold uppercase tracking-wider">Ask about species characteristics, nesting protocols, or population trends.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white' 
                    : 'bg-white/5 border border-white/10 text-slate-300'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 text-slate-500 px-3 py-2 rounded-xl text-[10px] font-black uppercase animate-pulse">
                  Analyzing field data...
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-white/5 bg-black/20">
            <div className="relative">
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-xs focus:ring-1 focus:ring-primary outline-none text-white placeholder:text-slate-600" 
                placeholder="Ask the researcher AI..." 
                type="text" 
              />
              <button 
                onClick={handleSend}
                className="absolute right-2 top-1.5 material-symbols-outlined text-primary hover:text-white transition-colors"
              >
                send
              </button>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="size-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center transition-all active:scale-90 group relative"
      >
        <span className={`material-symbols-outlined text-3xl transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>
          {isOpen ? 'close' : 'psychology'}
        </span>
        {!isOpen && (
          <div className="absolute right-full mr-4 bg-white dark:bg-[#1a232e] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#283039] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">AI Research Consultant</p>
          </div>
        )}
      </button>
    </div>
  );
};

export default AIConsultant;
