# Chat Support System - Implementation Guide

## Overview
A complete real-time chat system allowing admins to communicate with users. Features include:
- Real-time messaging via WebSockets
- REST API for chat history
- Conversation management
- Read receipts
- Typing indicators
- Admin can chat with any user
- Users can only chat with admins

## Database Schema

### ChatConversation
- `id`: Unique conversation identifier
- `userId`: The user participating in the conversation
- `status`: ACTIVE or CLOSED
- `lastMessageAt`: Timestamp of last message
- `createdAt`, `updatedAt`: Timestamps

### ChatMessage
- `id`: Unique message identifier
- `conversationId`: Reference to conversation
- `senderId`: User who sent the message (can be admin or user)
- `content`: Message text
- `isRead`: Boolean for read status
- `createdAt`: Timestamp

## Setup Instructions

### 1. Run Database Migration
```bash
npx prisma migrate dev --name add_chat_support
```

If you encounter drift issues, you can reset the database (⚠️ **WARNING: This will delete all data**):
```bash
npx prisma migrate reset
npx prisma migrate dev
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Start the Server
```bash
npm run start:dev
```

The WebSocket server will be available at: `ws://localhost:3000/chat`

## API Endpoints

### REST API

#### 1. Send Message
```http
POST /chat/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "conversationId": 1,  // Optional for first message
  "content": "Hello!",
  "userId": 2  // Required for admin starting new conversation
}
```

#### 2. Get All Conversations
```http
GET /chat/conversations?status=ACTIVE
Authorization: Bearer <token>
```

#### 3. Get Specific Conversation
```http
GET /chat/conversations/:id
Authorization: Bearer <token>
```

#### 4. Get Messages in Conversation
```http
GET /chat/conversations/:id/messages
Authorization: Bearer <token>
```

#### 5. Mark Messages as Read
```http
POST /chat/conversations/:id/read
Authorization: Bearer <token>
```

#### 6. Update Conversation Status (Admin Only)
```http
PATCH /chat/conversations/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "CLOSED"
}
```

#### 7. Get Unread Count
```http
GET /chat/unread-count
Authorization: Bearer <token>
```

## WebSocket Events

### Client → Server

#### 1. Authenticate
```javascript
socket.emit('authenticate', {
  userId: 1,
  email: 'user@example.com',
  role: 'USER' // or 'ADMIN'
});
```

#### 2. Send Message
```javascript
socket.emit('sendMessage', {
  conversationId: 1,  // Optional for first message
  content: 'Hello!',
  userId: 2  // Required for admin starting conversation
});
```

#### 3. Mark as Read
```javascript
socket.emit('markAsRead', {
  conversationId: 1
});
```

#### 4. Typing Indicator
```javascript
socket.emit('typing', {
  conversationId: 1,
  isTyping: true
});
```

### Server → Client

#### 1. New Message
```javascript
socket.on('newMessage', (message) => {
  console.log('New message:', message);
});
```

#### 2. Messages Read
```javascript
socket.on('messagesRead', (data) => {
  console.log('Messages read in conversation:', data.conversationId);
});
```

#### 3. User Typing
```javascript
socket.on('userTyping', (data) => {
  console.log('User typing:', data);
});
```

## Frontend Integration Example

### React with Socket.IO Client

```bash
npm install socket.io-client
```

```javascript
import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

function ChatComponent({ user, token }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3000/chat', {
      transports: ['websocket'],
    });

    // Authenticate
    newSocket.emit('authenticate', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Listen for new messages
    newSocket.on('newMessage', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for typing indicators
    newSocket.on('userTyping', (data) => {
      console.log('User typing:', data);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, [user]);

  // Load conversations on mount
  useEffect(() => {
    fetch('http://localhost:3000/chat/conversations', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => setConversations(data));
  }, [token]);

  const sendMessage = (conversationId, content) => {
    socket.emit('sendMessage', {
      conversationId,
      content,
    });
  };

  const markAsRead = (conversationId) => {
    socket.emit('markAsRead', { conversationId });
  };

  return (
    <div>
      {/* Your chat UI here */}
    </div>
  );
}
```

## Usage Scenarios

### Scenario 1: User Starts Conversation
1. User sends first message without `conversationId`
2. System creates new conversation automatically
3. Admin receives notification via WebSocket
4. Admin can reply to the conversation

### Scenario 2: Admin Starts Conversation
1. Admin sends message with `userId` (target user)
2. System creates conversation with that user
3. User receives notification via WebSocket
4. User can reply to the conversation

### Scenario 3: Continuing Conversation
1. Either party sends message with `conversationId`
2. Message is added to existing conversation
3. Both parties receive real-time notification

## Security Features

- JWT authentication required for all endpoints
- Users can only access their own conversations
- Admins can access all conversations
- Only admins can update conversation status
- WebSocket authentication required before messaging

## Testing the Chat System

### Using Postman or Thunder Client

1. **Login as User**
   ```http
   POST /auth/login
   { "email": "user@example.com", "password": "password" }
   ```

2. **Login as Admin**
   ```http
   POST /auth/login
   { "email": "admin@example.com", "password": "password" }
   ```

3. **User Sends First Message**
   ```http
   POST /chat/messages
   Authorization: Bearer <user_token>
   { "content": "I need help!" }
   ```

4. **Admin Views Conversations**
   ```http
   GET /chat/conversations
   Authorization: Bearer <admin_token>
   ```

5. **Admin Replies**
   ```http
   POST /chat/messages
   Authorization: Bearer <admin_token>
   { "conversationId": 1, "content": "How can I help you?" }
   ```

### Using WebSocket Testing Tools

Use tools like:
- [Socket.IO Client Tool](https://amritb.github.io/socketio-client-tool/)
- Postman WebSocket support
- Browser console with socket.io-client

## Troubleshooting

### Lint Errors About PrismaService
These will resolve after running:
```bash
npx prisma generate
```

### Database Drift Issues
If migration fails due to drift:
```bash
npx prisma db push
```
Or reset the database (⚠️ **deletes all data**):
```bash
npx prisma migrate reset
```

### WebSocket Connection Issues
- Ensure CORS is properly configured
- Check firewall settings
- Verify the server is running on the correct port
- Check browser console for connection errors

## Next Steps

1. Run the database migration
2. Generate Prisma client
3. Test the REST API endpoints
4. Test WebSocket connections
5. Build your frontend chat UI
6. Add push notifications (optional)
7. Add file/image sharing (optional)
8. Add message search functionality (optional)

## Support

For issues or questions, check:
- Prisma logs: Check console output
- WebSocket logs: Check server console for connection events
- API logs: Check NestJS request logs
