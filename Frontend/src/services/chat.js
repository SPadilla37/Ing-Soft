export function renderConversationsSection({
  conversationsList,
  conversationTotalEl,
  chatCountBadgeEl,
  currentConversations,
  selectedConversationId,
  onSelectConversation,
}) {
  conversationsList.innerHTML = "";
  conversationTotalEl.textContent = String(currentConversations.length);
  chatCountBadgeEl.textContent = String(currentConversations.length);

  if (!currentConversations.length) {
    const empty = document.createElement("div");
    empty.className = "list-item";
    empty.textContent = "Todavia no tienes conversaciones.";
    conversationsList.appendChild(empty);
    return;
  }

  currentConversations.forEach((conversation) => {
    const otherName = conversation.other_user_name || String(conversation.other_user_id);
    const item = document.createElement("div");
    item.className = `list-item${String(selectedConversationId) === String(conversation.id) ? " active" : ""}`;
    item.innerHTML = `<strong>${otherName}</strong>`;
    item.onclick = () => onSelectConversation(conversation.id);
    conversationsList.appendChild(item);
  });
}

export function appendChatMessage({ chatBox, currentUser, message }) {
  const row = document.createElement("div");
  row.className = `chat-msg${message.from_user_id === currentUser ? " mine" : ""}`;
  const meta = document.createElement("span");
  meta.className = "chat-meta";
  meta.textContent = `${message.from_user_id}${message.sent_at ? ` · ${new Date(message.sent_at).toLocaleTimeString()}` : ""}`;
  const body = document.createElement("div");
  body.textContent = message.content;
  row.appendChild(meta);
  row.appendChild(body);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

export function connectConversationSocket({
  autoConnect = false,
  conversationId,
  currentUser,
  socketState,
  setChatStatus,
  log,
  buildWsUrl,
  chatBox,
}) {
  const cid = String(conversationId ?? "").trim();
  if (!cid) {
    if (!autoConnect) {
      alert("Selecciona una conversacion primero.");
    }
    return;
  }

  const alreadyConnected =
    socketState.socket &&
    socketState.socket.readyState === WebSocket.OPEN &&
    String(socketState.connectedConversationId) === cid;

  if (alreadyConnected) {
    setChatStatus(`Ya estas conectado al chat ${cid}.`, "ok");
    return;
  }

  // Cerrar cualquier socket anterior (OPEN o CONNECTING) para no dejar conexiones huérfanas
  // que luego disparen onclose y desconecten la sesión nueva.
  if (socketState.socket) {
    try {
      socketState.socket.close();
    } catch {
      /* ignore */
    }
    socketState.socket = null;
  }
  socketState.connectedConversationId = "";

  setChatStatus("Conectando chat...", "info");
  const ws = new WebSocket(buildWsUrl(cid, currentUser));
  socketState.socket = ws;

  ws.onopen = () => {
    if (socketState.socket !== ws) return;
    socketState.connectedConversationId = cid;
    setChatStatus(`Conectado al chat ${cid}.`, "ok");
    log(`WS conectado a ${cid}`);
  };

  ws.onmessage = (event) => {
    if (socketState.socket !== ws) return;
    try {
      const data = JSON.parse(event.data);
      if (data.type === "history") {
        chatBox.innerHTML = "";
        (data.messages || []).forEach((message) => {
          appendChatMessage({ chatBox, currentUser, message });
        });
      } else if (data.type === "chat_message") {
        appendChatMessage({ chatBox, currentUser, message: data.message });
      } else {
        log(`WS evento: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      log(`WS mensaje no valido: ${err?.message || err}`);
    }
  };

  ws.onerror = () => {
    if (socketState.socket !== ws) return;
    socketState.connectedConversationId = "";
    setChatStatus("Error en la conexion del chat.", "error");
    log("WS error");
  };

  ws.onclose = () => {
    if (socketState.socket !== ws) return;
    socketState.connectedConversationId = "";
    socketState.socket = null;
    setChatStatus("Chat desconectado.", "info");
    log("WS cerrado");
  };
}

export function disconnectConversationSocket({ socketState, setChatStatus }) {
  const ws = socketState.socket;
  if (ws) {
    socketState.socket = null;
    socketState.connectedConversationId = "";
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  } else {
    socketState.connectedConversationId = "";
  }
  setChatStatus("Chat desconectado.", "info");
}

export function sendConversationMessage({ socketState, content }) {
  if (!socketState.socket || socketState.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  if (!content) {
    return true;
  }
  try {
    socketState.socket.send(JSON.stringify({ type: "message", content }));
  } catch (err) {
    return false;
  }
  return true;
}
