const net = require('net');

// Define the port the server will listen on
const PORT = 12345;

// Store connected clients by name
const clients = new Map(); // { clientName: socket }
const chatSessions = new Map(); // { clientName: partnerName }
const pendingRequests = new Map(); // { clientName: requesterName }

// Create the server
const server = net.createServer((socket) => {
  console.log('A new client connected.');

  let clientName = null;

  // Handle client data
  socket.on('data', (data) => {
    const message = data.toString().trim();

    // If client has not identified themselves yet
    if (!clientName) {
      clientName = message; // First message is treated as the client's name
      if (clients.has(clientName)) {
        socket.write(`Error: Name "${clientName}" is already in use. Please restart and choose a different name.
`);
        socket.destroy();
        return;
      }
      clients.set(clientName, socket);
      console.log(`${clientName} has joined.`);
      return;
    }

    // Prevent clients from chatting with themselves
    if (message === clientName) {
      socket.write(`Error: You cannot chat with yourself. Type the name of another client.
`);
      return;
    }

    // Handle ending the chat
    if (message.toUpperCase() === 'END CHAT') {
      const partnerName = chatSessions.get(clientName);
      if (partnerName) {
        const partnerSocket = clients.get(partnerName);
        if (partnerSocket) {
          partnerSocket.write(`${clientName} has ended the chat (By leaving). Who would you like to chat with?
`);
        }
        chatSessions.delete(partnerName);
        chatSessions.delete(clientName);
      }
      socket.write(`Chat ended. Type the name of the client you want to chat with.
`);
      return;
    }

    // If client has not selected a chat partner
    if (!chatSessions.has(clientName)) {
      const partnerName = message;

      // Check if the partner exists
      if (clients.has(partnerName)) {
        const partnerSocket = clients.get(partnerName);

        // Check if the partner is already in a chat
        if (chatSessions.has(partnerName)) {
          // If there is already a pending request for this partner, ignore further responses
          if (pendingRequests.has(partnerName)) {
            socket.write(`Waiting for ${partnerName} to respond.
`);
            return;
          }

          pendingRequests.set(partnerName, clientName);
          partnerSocket.write(`${clientName} wants to chat with you. Type "YES" to accept and end your current chat, or "NO" (or any other response) to decline.
`);
          socket.write(`Waiting for ${partnerName} to respond.
`);
        } else {
          // Establish a chat session
          chatSessions.set(clientName, partnerName);
          chatSessions.set(partnerName, clientName); // Set a two-way session
          socket.write(`You are now chatting with ${partnerName}.
`);
          partnerSocket.write(`${clientName} has started a chat with you.
`);
        }
      } else {
        socket.write(`Error: Client "${partnerName}" is not connected.
`);
      }
      return;
    }

    // Handle response to a pending request
    if (pendingRequests.has(clientName)) {
      const requesterName = pendingRequests.get(clientName);
      const requesterSocket = clients.get(requesterName);

      // Only handle the first response
      pendingRequests.delete(clientName);

      if (message.toUpperCase() === 'YES') {
        // End the current session if exists
        const currentPartner = chatSessions.get(clientName);
        if (currentPartner) {
          const currentPartnerSocket = clients.get(currentPartner);
          if (currentPartnerSocket) {
            currentPartnerSocket.write(`${clientName} has left the chat (By leaving). Who would you like to chat with?
`);
          }
          chatSessions.delete(currentPartner);
        }

        // Establish the new session
        chatSessions.set(clientName, requesterName);
        chatSessions.set(requesterName, clientName);
        socket.write(`You are now chatting with ${requesterName}.
`);
        requesterSocket.write(`Your request to chat with ${clientName} has been accepted. You are now chatting with them.
`);
      } else {
        requesterSocket.write(`${clientName} declined your request to chat.
`);
        socket.write(`You declined the request to chat with ${requesterName}.
`);
      }
      return;
    }

    // Handle seamless messaging within the session
    const partnerName = chatSessions.get(clientName);
    const partnerSocket = clients.get(partnerName);

    if (partnerSocket) {
      partnerSocket.write(`[${clientName}]: ${message}
`);
    } else {
      socket.write(`Error: Your chat partner "${partnerName}" has disconnected.
`);
      chatSessions.delete(clientName);
    }
  });

  // Handle client disconnection
  socket.on('end', () => {
    handleDisconnection(clientName, 'By leaving');
  });

  // Handle sudden socket closure (e.g., server crash or CTRL+C)
  socket.on('close', () => {
    handleDisconnection(clientName, 'By crash');
  });

  // Unified function to handle client disconnection
  function handleDisconnection(clientName, disconnectType) {
    if (clientName) {
      const partnerName = chatSessions.get(clientName);

      if (partnerName) {
        const partnerSocket = clients.get(partnerName);
        if (partnerSocket) {
          partnerSocket.write(`${clientName} has exited the chat (${disconnectType}). Who would you like to chat with?
`);
        }
        chatSessions.delete(partnerName); // End the session for the partner
      }

      clients.delete(clientName);
      chatSessions.delete(clientName);

      // Remove pending requests involving this client
      pendingRequests.forEach((requester, target) => {
        if (target === clientName || requester === clientName) {
          pendingRequests.delete(target);
        }
      });

      console.log(`${clientName} disconnected (${disconnectType}).`);
    }
  }

  // Handle socket errors
  socket.on('error', (err) => {
    console.error('Socket error:', err.message);
  });
});

// Start listening on the specified port
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}...`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err.message);
});

// Client reconnection logic (reconnect every 5 seconds)
const reconnectClients = () => {
  clients.forEach((socket, clientName) => {
    socket.on('close', () => {
      console.log(
        `${clientName} disconnected unexpectedly. Attempting to reconnect...`
      );
      setTimeout(() => {
        const newSocket = net.createConnection({ port: PORT }, () => {
          console.log(`${clientName} reconnected successfully.`);
          clients.set(clientName, newSocket);
        });

        newSocket.on('error', (err) => {
          console.error(
            `Reconnection attempt for ${clientName} failed: ${err.message}`
          );
        });
      }, 5000);
    });
  });
};

reconnectClients();
