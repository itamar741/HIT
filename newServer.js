const net = require('net');

const PORT = 12345;

const clients = new Map(); // { clientName: socket }
const chatSessions = new Map(); // { clientName: partnerName }
const pendingRequests = new Map(); // { clientName: requesterName }

const server = net.createServer((socket) => {
  console.log('A client connected.');

  let clientName = null;

  socket.on('data', (data) => {
    const message = data.toString().trim();

    if (!clientName) {
      clientName = message;
      if (clients.has(clientName)) {
        socket.write(`Error: Name "${clientName}" is already in use. Restart and choose a different name.
`);
        socket.destroy();
        return;
      }
      clients.set(clientName, socket);
      console.log(`${clientName} joined.`);
      return;
    }

    if (message === clientName) {
      socket.write(`Error: You cannot chat with yourself. Type the name of another client.
`);
      return;
    }

    if (message.toUpperCase() === 'END CHAT') {
      endChat(clientName);
      socket.write(`Chat ended. Type the name of the client you want to chat with.
`);
      return;
    }

    if (!chatSessions.has(clientName)) {
      initiateChat(clientName, message, socket);
      return;
    }

    if (pendingRequests.has(clientName)) {
      handlePendingRequest(clientName, message);
      return;
    }

    forwardMessage(clientName, message);
  });

  socket.on('end', () => handleDisconnection(clientName, 'By leaving'));
  socket.on('close', () => handleDisconnection(clientName, 'By crash'));
  socket.on('error', (err) => console.error(`Socket error: ${err.message}`));

  function endChat(clientName) {
    const partnerName = chatSessions.get(clientName);
    if (partnerName) {
      const partnerSocket = clients.get(partnerName);
      if (partnerSocket) {
        partnerSocket.write(`${clientName} has ended the chat. Who would you like to chat with?
`);
      }
      chatSessions.delete(clientName);
      chatSessions.delete(partnerName);
    }
  }

  function initiateChat(clientName, partnerName, socket) {
    if (clients.has(partnerName)) {
      const partnerSocket = clients.get(partnerName);
      if (chatSessions.has(partnerName)) {
        if (!pendingRequests.has(partnerName)) {
          pendingRequests.set(partnerName, clientName);
          partnerSocket.write(`${clientName} wants to chat with you. Type "YES" to accept, or "NO" to decline.
`);
          socket.write(`Waiting for ${partnerName} to respond.
`);
        } else {
          socket.write(`Waiting for ${partnerName} to respond.
`);
        }
      } else {
        chatSessions.set(clientName, partnerName);
        chatSessions.set(partnerName, clientName);
        socket.write(`You are now chatting with ${partnerName}.
`);
        partnerSocket.write(`${clientName} has started a chat with you.
`);
      }
    } else {
      socket.write(`Error: Client "${partnerName}" is not connected.
`);
    }
  }

  function handlePendingRequest(clientName, response) {
    const requesterName = pendingRequests.get(clientName);
    const requesterSocket = clients.get(requesterName);
    pendingRequests.delete(clientName);

    if (response.toUpperCase() === 'YES') {
      endChat(clientName);
      chatSessions.set(clientName, requesterName);
      chatSessions.set(requesterName, clientName);
      requesterSocket.write(`Your request to chat with ${clientName} has been accepted.
`);
      clients.get(clientName).write(`You are now chatting with ${requesterName}.
`);
    } else {
      requesterSocket.write(`${clientName} declined your request to chat.
`);
      clients.get(clientName)
        .write(`You declined the request to chat with ${requesterName}.
`);
    }
  }

  function forwardMessage(clientName, message) {
    const partnerName = chatSessions.get(clientName);
    const partnerSocket = clients.get(partnerName);

    if (partnerSocket) {
      partnerSocket.write(`[${clientName}]: ${message}
`);
    } else {
      clients.get(clientName).write(`Error: Your chat partner has disconnected.
`);
      chatSessions.delete(clientName);
    }
  }

  function handleDisconnection(clientName, disconnectType) {
    if (clientName) {
      const partnerName = chatSessions.get(clientName);
      if (partnerName) {
        const partnerSocket = clients.get(partnerName);
        if (partnerSocket) {
          partnerSocket.write(`${clientName} has disconnected (${disconnectType}). Who would you like to chat with?
`);
        }
        chatSessions.delete(partnerName);
      }
      clients.delete(clientName);
      chatSessions.delete(clientName);
      pendingRequests.forEach((requester, target) => {
        if (target === clientName || requester === clientName) {
          pendingRequests.delete(target);
        }
      });
      console.log(`${clientName} disconnected (${disconnectType}).`);
    }
  }
});

server.listen(PORT, () =>
  console.log(`Server is listening on port ${PORT}...`)
);

server.on('error', (err) => console.error(`Server error: ${err.message}`));
