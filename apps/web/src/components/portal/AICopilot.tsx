'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

// ── Bubble ─────────────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '0.5rem',
      }}
    >
      {!isUser && (
        <div style={{
          width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
          background: 'linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color: 'rgb(7,17,31)',
          marginRight: '0.5rem', marginTop: '2px',
        }}>YG</div>
      )}
      <div style={{
        maxWidth: '78%',
        padding: '0.6rem 0.875rem',
        borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
        fontSize: '0.8rem',
        lineHeight: 1.55,
        background: isUser
          ? 'linear-gradient(135deg, rgb(77,163,255), rgb(99,163,255))'
          : 'rgba(255,255,255,0.06)',
        color: isUser ? '#fff' : 'rgb(210,220,235)',
        border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
    </motion.div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
      <div style={{
        width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
        background: 'linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.7rem', fontWeight: 800, color: 'rgb(7,17,31)',
        marginRight: '0.5rem', marginTop: '2px',
      }}>YG</div>
      <div style={{
        padding: '0.6rem 0.875rem', borderRadius: '14px 14px 14px 4px',
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', gap: '4px', alignItems: 'center',
      }}>
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, delay, ease: 'easeInOut' }}
            style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgb(77,163,255)' }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Suggested prompts ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Como está a minha encomenda mais recente?',
  'Quais são os produtos mais populares?',
  'Como criar um orçamento novo?',
  'Qual o prazo de entrega habitual?',
];

// ── Main component ─────────────────────────────────────────────────────────────

export function AICopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Olá! Sou o teu assistente YourGift. Posso ajudar-te com encomendas, orçamentos, produtos e muito mais. Como posso ajudar? 🎁',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasNotification, setHasNotification] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setHasNotification(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content ?? 'Desculpa, não consegui processar o teu pedido.',
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Ocorreu um erro ao contactar o assistente. Por favor tenta novamente.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {/* ── Chat panel ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed',
              bottom: '84px',
              right: '1.25rem',
              width: '360px',
              maxHeight: '520px',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgb(10,18,32)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(77,163,255,0.08)',
              zIndex: 9990,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '0.875rem 1.125rem',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              background: 'rgba(77,163,255,0.04)',
            }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: 'linear-gradient(135deg, rgb(77,163,255), rgb(116,231,255))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem', fontWeight: 800, color: 'rgb(7,17,31)',
                boxShadow: '0 0 12px rgba(77,163,255,0.4)',
                flexShrink: 0,
              }}>YG</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgb(230,240,255)' }}>Assistente YourGift</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '1px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgb(99,230,190)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.65rem', color: 'rgb(99,230,190)' }}>Online · IA ativa</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer',
                  width: '28px', height: '28px', borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgb(120,132,150)', transition: 'all 150ms', flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '1rem',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.08) transparent',
            }}>
              {messages.map(msg => <Bubble key={msg.id} msg={msg} />)}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions (only when just 1 message = welcome) */}
            {messages.length === 1 && !loading && (
              <div style={{ padding: '0 1rem 0.625rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    style={{
                      fontSize: '0.68rem', color: 'rgb(77,163,255)',
                      background: 'rgba(77,163,255,0.08)',
                      border: '1px solid rgba(77,163,255,0.2)',
                      borderRadius: '8px', padding: '0.3rem 0.625rem',
                      cursor: 'pointer', transition: 'all 150ms', textAlign: 'left',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(77,163,255,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(77,163,255,0.08)'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreve uma mensagem..."
                rows={1}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px', padding: '0.625rem 0.75rem',
                  fontSize: '0.8rem', color: 'rgb(220,230,245)',
                  outline: 'none', resize: 'none', lineHeight: 1.5,
                  maxHeight: '100px', overflow: 'auto',
                  fontFamily: 'inherit', transition: 'border-color 150ms',
                }}
                onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(77,163,255,0.4)'; }}
                onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: input.trim() && !loading
                    ? 'linear-gradient(135deg, rgb(77,163,255), rgb(99,163,255))'
                    : 'rgba(255,255,255,0.06)',
                  border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 150ms',
                  boxShadow: input.trim() && !loading ? '0 4px 12px rgba(77,163,255,0.3)' : 'none',
                }}
              >
                {loading ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 019.6 7.3" stroke="rgba(255,255,255,0.9)" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : 'rgb(80,92,110)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z" />
                  </svg>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB button ──────────────────────────────────────────────────────── */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          right: '1.25rem',
          width: '52px', height: '52px',
          borderRadius: '16px',
          background: isOpen
            ? 'rgba(30,40,60,0.95)'
            : 'linear-gradient(135deg, rgb(77,163,255) 0%, rgb(116,100,255) 100%)',
          border: isOpen ? '1px solid rgba(77,163,255,0.3)' : 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isOpen
            ? '0 0 0 1px rgba(77,163,255,0.2)'
            : '0 8px 24px rgba(77,163,255,0.4), 0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 9991,
          transition: 'background 250ms, box-shadow 250ms',
        }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 90 }} transition={{ duration: 0.15 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(77,163,255)" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </motion.div>
          ) : (
            <motion.div key="open" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.15 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification dot */}
        {hasNotification && !isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position: 'absolute', top: '-4px', right: '-4px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: 'rgb(99,230,190)',
              border: '2px solid rgb(7,17,31)',
            }}
          />
        )}
      </motion.button>
    </>
  );
}
