import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import { wsUrl } from '../../../services/websocket';

const ChatView = ({ initialConversationId = null, onBadgeUpdate }) => {
  const { currentUser, currentUserRecord } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Selecciona una conversación.');
  const socketRef = useRef(null);
  const chatBoxRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const selectedConvRef = useRef(null);
  const shouldReconnectRef = useRef(false);
  const outgoingQueueRef = useRef([]);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  const loadMessages = async (convId) => {
    if (!currentUser || !convId) return;
    try {
      const result = await apiRequest(API_BASE, `/conversations/${encodeURIComponent(convId)}/messages?viewer_user_id=${encodeURIComponent(currentUser)}`);
      setMessages(result.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadConversations = async () => {
    if (!currentUser) return;
    try {
      const result = await apiRequest(API_BASE, `/conversations/${encodeURIComponent(currentUser)}`);
      const list = result.conversations || [];
      setConversations(list);

      let target = null;
      if (initialConversationId) {
        target = list.find((conv) => String(conv.id) === String(initialConversationId)) || null;
      }
      if (!target && !selectedConv && list.length > 0) {
        target = list[0];
      }

      if (target) {
        setSelectedConv(target);
        selectedConvRef.current = target;
        await loadMessages(target.id);
        if (target.can_chat) {
          connectWs(target.id);
        } else {
          setStatus('Chat cerrado: el match fue finalizado.');
        }
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  useEffect(() => {
    loadConversations();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [currentUser, initialConversationId]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const flushQueue = () => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    while (outgoingQueueRef.current.length > 0) {
      const content = outgoingQueueRef.current.shift();
      ws.send(JSON.stringify({ type: 'message', content }));
    }
  };

  const scheduleReconnect = (convId) => {
    if (!shouldReconnectRef.current) return;
    if (!selectedConvRef.current || selectedConvRef.current.id !== convId) return;

    const attempt = reconnectAttemptsRef.current + 1;
    reconnectAttemptsRef.current = attempt;
    const delayMs = Math.min(5000, 500 * attempt);
    setStatus(`Reconectando chat (${attempt})...`);

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => {
      connectWs(convId);
    }, delayMs);
  };

  const connectWs = (convId) => {
    const selected = selectedConvRef.current;
    if (selected && !selected.can_chat) {
      setStatus('Chat cerrado: el match fue finalizado.');
      return;
    }

    shouldReconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
    }

    setStatus('Conectando chat...');
    const url = wsUrl(API_BASE, convId, currentUser);
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setStatus('Conectado.');
      flushQueue();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'history') {
        setMessages(data.messages);
      } else if (data.type === 'chat_message') {
        setMessages(prev => [...prev, data.message]);
      } else if (data.type === 'error') {
        setStatus(data.detail || 'No se pudo enviar el mensaje.');
      }
    };

    ws.onclose = () => {
      if (socketRef.current === ws) {
        socketRef.current = null;
      }
      setStatus('Chat desconectado.');
      scheduleReconnect(convId);
    };
    ws.onerror = () => setStatus('Error en la conexión.');
  };

  const handleSelectConv = (conv) => {
    setSelectedConv(conv);
    selectedConvRef.current = conv;
    setMessages([]);
    outgoingQueueRef.current = [];
    loadMessages(conv.id);
    if (conv.can_chat) {
      connectWs(conv.id);
    } else {
      shouldReconnectRef.current = false;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setStatus('Chat cerrado: el match fue finalizado.');
    }
  };

  const handleSend = () => {
    const content = input.trim();
    if (!content || !selectedConv) return;
    if (!selectedConv.can_chat) {
      setStatus('No puedes enviar mensajes porque el match ya fue finalizado.');
      return;
    }

    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', content }));
    } else {
      outgoingQueueRef.current.push(content);
      setStatus('Sin conexión: mensaje en cola, reconectando...');
      connectWs(selectedConv.id);
    }
    setInput('');
    if (onBadgeUpdate) onBadgeUpdate();
  };

  const getSenderDisplayName = (fromUserId) => {
    if (String(fromUserId) === String(currentUser)) {
      return currentUserRecord?.name || 'Tú';
    }
    if (selectedConv?.other_user_name) {
      return selectedConv.other_user_name;
    }
    return `Usuario ${fromUserId}`;
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <section className="grid lg:grid-cols-[320px_1fr] gap-6 h-[calc(100vh-12rem)]">
      {/* Conversations List */}
      <div className="bg-surface-container-highest rounded-2xl border border-outline-variant/10 p-6 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">chat</span>
          </div>
          <h2 className="font-headline font-bold text-xl text-on-surface">Conversaciones</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-2">chat_bubble_outline</span>
              <p className="text-on-surface-variant text-sm">Sin conversaciones</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                className={`w-full text-left p-4 rounded-xl transition-all ${
                  selectedConv?.id === conv.id
                    ? 'bg-primary/10 border-2 border-primary/30'
                    : 'bg-surface-container hover:bg-surface-container-high border-2 border-transparent'
                }`}
                onClick={() => handleSelectConv(conv)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary-dim flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {getInitials(conv.other_user_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface truncate">
                      {conv.other_user_name || `Usuario ${conv.other_user_id}`}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      Conversación #{conv.id}{!conv.can_chat ? ' - finalizada' : ''}
                    </p>
                  </div>
                  {selectedConv?.id === conv.id && (
                    <span className="material-symbols-outlined text-primary text-xl">check_circle</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="bg-surface-container-highest rounded-2xl border border-outline-variant/10 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="p-6 border-b border-outline-variant/10">
          {selectedConv ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-secondary-dim flex items-center justify-center text-white font-bold text-lg">
                  {getInitials(selectedConv.other_user_name)}
                </div>
                <div>
                  <h3 className="font-headline font-bold text-xl text-on-surface">
                    {selectedConv.other_user_name || `Usuario ${selectedConv.other_user_id}`}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${status === 'Conectado.' ? 'bg-secondary' : 'bg-on-surface-variant/30'}`}></span>
                    <p className="text-sm text-on-surface-variant">{status}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-on-surface-variant">Selecciona una conversación para comenzar</p>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div 
          ref={chatBoxRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4">forum</span>
              <p className="text-on-surface-variant">No hay mensajes aún</p>
              <p className="text-on-surface-variant/70 text-sm mt-1">Envía el primer mensaje para comenzar</p>
            </div>
          ) : (
            messages.map((msg, i) => {
              const isMine = String(msg.from_user_id) === String(currentUser);
              return (
                <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${isMine ? 'order-2' : 'order-1'}`}>
                    <div className={`rounded-2xl px-4 py-3 ${
                      isMine
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-surface-container text-on-surface rounded-bl-sm'
                    }`}>
                      <p className="text-xs font-semibold mb-1 opacity-70">
                        {getSenderDisplayName(msg.from_user_id)}
                      </p>
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input Area */}
        <div className="p-6 border-t border-outline-variant/10">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={selectedConv?.can_chat ? 'Escribe un mensaje...' : 'Chat cerrado por match finalizado'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={!selectedConv || !selectedConv.can_chat}
              className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl py-3 px-4 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!selectedConv || !selectedConv.can_chat || !input.trim()}
              className="px-6 py-3 bg-primary-dim hover:bg-primary text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <span className="material-symbols-outlined">send</span>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatView;
