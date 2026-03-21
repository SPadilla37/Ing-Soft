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
    const participantsLabel = (conversation.participants_display && conversation.participants_display.length)
      ? conversation.participants_display.join(" / ")
      : conversation.participants.join(" / ");

    const item = document.createElement("div");
    item.className = `list-item${selectedConversationId === conversation.id ? " active" : ""}`;
    item.innerHTML = `
      <strong>${participantsLabel}</strong>
      <div class="muted">${conversation.request?.offered_skill || "-"}</div>
      <div class="muted">${conversation.request?.requested_skill || "-"}</div>
    `;
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
  if (!conversationId) {
    if (!autoConnect) {
      alert("Selecciona una conversacion primero.");
    }
    return;
  }

  const alreadyConnected = socketState.socket
    && socketState.socket.readyState === WebSocket.OPEN
    && socketState.connectedConversationId === conversationId;

  if (alreadyConnected) {
    setChatStatus(`Ya estas conectado al chat ${conversationId}.`, "ok");
    return;
  }

  if (socketState.socket && socketState.socket.readyState === WebSocket.OPEN) {
    socketState.socket.close();
  }

  setChatStatus("Conectando chat...", "info");
  socketState.socket = new WebSocket(buildWsUrl(conversationId, currentUser));

  socketState.socket.onopen = () => {
    socketState.connectedConversationId = conversationId;
    setChatStatus(`Conectado al chat ${conversationId}.`, "ok");
    log(`WS conectado a ${conversationId}`);
  };

  socketState.socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "history") {
      chatBox.innerHTML = "";
      data.messages.forEach((message) => {
        appendChatMessage({ chatBox, currentUser, message });
      });
    } else if (data.type === "chat_message") {
      appendChatMessage({ chatBox, currentUser, message: data.message });
    } else {
      log(`WS evento: ${JSON.stringify(data)}`);
    }
  };

  socketState.socket.onerror = () => {
    socketState.connectedConversationId = "";
    setChatStatus("Error en la conexion del chat.", "error");
    log("WS error");
  };

  socketState.socket.onclose = () => {
    socketState.connectedConversationId = "";
    setChatStatus("Chat desconectado.", "info");
    log("WS cerrado");
  };
}

export function disconnectConversationSocket({ socketState, setChatStatus }) {
  if (socketState.socket) {
    socketState.socket.close();
    socketState.socket = null;
  }
  socketState.connectedConversationId = "";
  setChatStatus("Chat desconectado.", "info");
}

export function sendConversationMessage({ socketState, content }) {
  if (!socketState.socket || socketState.socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  if (!content) {
    return true;
  }
  socketState.socket.send(JSON.stringify({ type: "chat_message", content }));
  return true;
}
