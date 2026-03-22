import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api as apiRequest } from '../../../services/api';
import { API_BASE } from '../../../config/constants';
import { wsUrl } from '../../../services/websocket';

const ChatView = () => {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('Selecciona una conversación.');
  const socketRef = useRef(null);
  const chatBoxRef = useRef(null);

  const loadConversations = async () => {
    if (!currentUser) return;
    try {
      const result = await apiRequest(API_BASE, `/conversations/${encodeURIComponent(currentUser)}`);
      setConversations(result.conversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  useEffect(() => {
    loadConversations();
    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [currentUser]);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  const connectWs = (convId) => {
    if (socketRef.current) socketRef.current.close();
    
    setStatus('Conectando chat...');
    const url = wsUrl(API_BASE, convId, currentUser);
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('Conectado.');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'history') {
        setMessages(data.messages);
      } else if (data.type === 'chat_message') {
        setMessages(prev => [...prev, data.message]);
      }
    };

    ws.onclose = () => setStatus('Chat desconectado.');
    ws.onerror = () => setStatus('Error en la conexión.');
  };

  const handleSelectConv = (conv) => {
    setSelectedConv(conv);
    setMessages([]);
    connectWs(conv.id);
  };

  const handleSend = () => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.send(JSON.stringify({ type: 'message', content: input }));
    setInput('');
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
                <div className="muted">Conversacion #{conv.id}</div>
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
                <span className="chat-meta">{msg.from_user_id}</span>
                <div>{msg.content}</div>
              </div>
            ))}
          </div>
          <div className="composer">
            <input 
              placeholder="Escribe mensaje..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="primary-btn" onClick={handleSend}>Enviar</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChatView;
