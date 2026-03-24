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

  return (
    <section id="chatView" className="view active">
      <div className="chat-layout">
        <div className="conversation-list">
          <h2>Conversaciones</h2>
          <div className="list">
            {conversations.map(conv => (
              <div 
                key={conv.id} 
                className={`list-item ${selectedConv?.id === conv.id ? 'active' : ''}`}
                onClick={() => handleSelectConv(conv)}
              >
                <strong>{conv.other_user_name || `Usuario ${conv.other_user_id}`}</strong>
                <div className="muted">Conversación #{conv.id}{!conv.can_chat ? ' - finalizada' : ''}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="chat-shell">
          <h2>Chat</h2>
          <div className="muted">{status}</div>
          <div className="chat-box" ref={chatBoxRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${String(msg.from_user_id) === String(currentUser) ? 'mine' : ''}`}>
                <span className="chat-meta">{getSenderDisplayName(msg.from_user_id)}</span>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>
          <div className="composer">
            <input 
              placeholder={selectedConv?.can_chat ? 'Escribe mensaje...' : 'Chat cerrado por match finalizado'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={!selectedConv || !selectedConv.can_chat}
            />
            <button className="primary-btn" onClick={handleSend} disabled={!selectedConv || !selectedConv.can_chat || !input.trim()}>
              Enviar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatView;
