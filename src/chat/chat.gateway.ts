import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';

interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<number, string>();

  constructor(private chatService: ChatService) {}

  handleConnection(client: AuthenticatedSocket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: AuthenticatedSocket) {
    console.log(`Client disconnected: ${client.id}`);
    if (client.user) {
      this.userSockets.delete(client.user.id);
    }
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { userId: number; email: string; role: string },
  ) {
    console.log('[ChatGateway] Authentication request:', {
      clientId: client.id,
      userId: data.userId,
      email: data.email,
      role: data.role,
    });

    client.user = {
      id: data.userId,
      email: data.email,
      role: data.role,
    };
    this.userSockets.set(data.userId, client.id);

    if (data.role === 'ADMIN') {
      client.join('admins');
      console.log('[ChatGateway] User joined admins room');
    } else {
      client.join(`user-${data.userId}`);
      console.log('[ChatGateway] User joined room:', `user-${data.userId}`);
    }

    console.log('[ChatGateway] Authentication successful for user:', data.userId);
    return { success: true, message: 'Authenticated successfully' };
  }

  @UsePipes(new ValidationPipe({ 
    transform: true, 
    whitelist: true,
    forbidNonWhitelisted: false,
    skipMissingProperties: false,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }))
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    console.log('[ChatGateway] Received sendMessage:', {
      clientId: client.id,
      userId: client.user?.id,
      isAuthenticated: !!client.user,
      dto,
    });

    if (!client.user) {
      console.error('[ChatGateway] Client not authenticated:', client.id);
      return { success: false, error: 'Not authenticated. Please authenticate first using the "authenticate" event.' };
    }

    try {
      console.log('[ChatGateway] Sending message for user:', client.user.id);
      const message = await this.chatService.sendMessage(client.user.id, dto);

      const conversation = await this.chatService.getConversation(
        message.conversationId,
        client.user.id,
        client.user.role === 'ADMIN',
      );

      this.server.to('admins').emit('newMessage', message);
      this.server.to(`user-${conversation.userId}`).emit('newMessage', message);

      console.log('[ChatGateway] Message sent successfully:', message.id);
      return { success: true, message };
    } catch (error) {
      console.error('[ChatGateway] Error in handleMessage:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: MarkReadDto,
  ) {
    if (!client.user) {
      return { error: 'Not authenticated' };
    }

    try {
      await this.chatService.markMessagesAsRead(dto.conversationId, client.user.id);

      const conversation = await this.chatService.getConversation(
        dto.conversationId,
        client.user.id,
        client.user.role === 'ADMIN',
      );

      this.server.to('admins').emit('messagesRead', { conversationId: dto.conversationId });
      this.server.to(`user-${conversation.userId}`).emit('messagesRead', { conversationId: dto.conversationId });

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: number; isTyping: boolean },
  ) {
    if (!client.user) {
      return { error: 'Not authenticated' };
    }

    try {
      const conversation = await this.chatService.getConversation(
        data.conversationId,
        client.user.id,
        client.user.role === 'ADMIN',
      );

      const typingData = {
        conversationId: data.conversationId,
        userId: client.user.id,
        userName: client.user.email,
        isTyping: data.isTyping,
      };

      this.server.to('admins').emit('userTyping', typingData);
      this.server.to(`user-${conversation.userId}`).emit('userTyping', typingData);

      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  notifyNewMessage(conversationId: number, userId: number, message: any) {
    this.server.to('admins').emit('newMessage', message);
    this.server.to(`user-${userId}`).emit('newMessage', message);
  }
}
