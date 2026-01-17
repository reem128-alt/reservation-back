import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../auth/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(senderId: number, dto: SendMessageDto) {
    let conversationId = dto.conversationId;

    if (!conversationId) {
      if (!dto.userId) {
        throw new BadRequestException('userId is required when starting a new conversation');
      }

      const sender = await this.prisma.user.findUnique({
        where: { id: senderId },
        select: { role: true },
      });

      if (sender?.role === 'ADMIN') {
        const existingConversation = await this.prisma.chatConversation.findFirst({
          where: {
            userId: dto.userId,
            status: 'ACTIVE',
          },
        });

        if (existingConversation) {
          conversationId = existingConversation.id;
        } else {
          const newConversation = await this.prisma.chatConversation.create({
            data: {
              userId: dto.userId,
            },
          });
          conversationId = newConversation.id;
        }
      } else {
        // User starting conversation - assign last active admin
        const lastActiveAdmin = await this.prisma.user.findFirst({
          where: {
            role: 'ADMIN',
          },
          orderBy: {
            id: 'desc',  // Most recently created admin (as proxy for activity)
          },
        });

        if (!lastActiveAdmin) {
          throw new BadRequestException('No admin available for support');
        }

        const existingConversation = await this.prisma.chatConversation.findFirst({
          where: {
            userId: senderId,
            status: 'ACTIVE',
          },
        });

        if (existingConversation) {
          conversationId = existingConversation.id;
        } else {
          const newConversation = await this.prisma.chatConversation.create({
            data: {
              userId: senderId,
            },
          });
          conversationId = newConversation.id;
        }
      }
    }

    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: { user: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { role: true },
    });

    if (sender?.role !== 'ADMIN' && conversation.userId !== senderId) {
      throw new ForbiddenException('You can only send messages in your own conversation');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId,
        content: dto.content,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
          },
        },
      },
    });

    await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async getConversations(userId: number, isAdmin: boolean, query?: ConversationQueryDto) {
    const where: any = {};

    if (!isAdmin) {
      where.userId = userId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    const conversations = await this.prisma.chatConversation.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                senderId: { not: userId },
              },
            },
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map((conv) => ({
      ...conv,
      unreadCount: conv._count.messages,
      lastMessage: conv.messages[0] || null,
    }));
  }

  async getConversation(conversationId: number, userId: number, isAdmin: boolean) {
    console.log('[ChatService] getConversation:', { conversationId, userId, isAdmin });
    
    const conversation = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    console.log('[ChatService] conversation.userId:', conversation.userId, 'requesterId:', userId, 'isAdmin:', isAdmin);

    if (!isAdmin && conversation.userId !== userId) {
      throw new ForbiddenException('You can only access your own conversation');
    }

    return conversation;
  }

  async getConversationByUserId(targetUserId: number, requesterId: number, isAdmin: boolean) {
    if (!isAdmin && targetUserId !== requesterId) {
      throw new ForbiddenException('You can only access your own conversation');
    }

    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        userId: targetUserId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: {
              where: {
                isRead: false,
                senderId: { not: requesterId },
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return null;
    }

    return {
      ...conversation,
      unreadCount: conversation._count.messages,
      lastMessage: conversation.messages[0] || null,
    };
  }

  async getMessages(conversationId: number, userId: number, isAdmin: boolean) {
    const conversation = await this.getConversation(conversationId, userId, isAdmin);

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  }

  async markMessagesAsRead(conversationId: number, userId: number) {
    await this.prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  }

  async updateConversationStatus(
    conversationId: number,
    userId: number,
    isAdmin: boolean,
    dto: UpdateConversationDto,
  ) {
    const conversation = await this.getConversation(conversationId, userId, isAdmin);

    if (!isAdmin) {
      throw new ForbiddenException('Only admins can update conversation status');
    }

    return this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { status: dto.status },
    });
  }

  async getUnreadCount(userId: number, isAdmin: boolean) {
    let where: any = {};

    if (!isAdmin) {
      // Regular user: count unread messages in their conversations
      where = {
        conversation: {
          userId: userId,
        },
        senderId: { not: userId },
        isRead: false,
      };
    } else {
      // Admin: count unread messages in all admin conversations
      where = {
        conversation: {
          userId: userId,
        },
        senderId: { not: userId },
        isRead: false,
      };
    }

    const count = await this.prisma.chatMessage.count({ where });

    return { unreadMessages: count };
  }

  async getUnreadDetails(adminId: number) {
    // Get ALL conversations where admin is a participant (either as userId or in messages)
    const conversations = await this.prisma.chatConversation.findMany({
      where: {
        OR: [
          { userId: adminId },  // Admin is the conversation owner
          {
            messages: {
              some: {
                senderId: adminId,  // Admin sent messages in this conversation
              },
            },
          },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          where: {
            senderId: { not: adminId },
            isRead: false,
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            senderId: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    
    // Format the response
    const unreadDetails = conversations.map(conv => ({
      conversationId: conv.id,
      user: conv.user,
      unreadCount: conv.messages.length,
      lastUnreadMessage: conv.messages[0] || null,
      lastActivity: conv.updatedAt,
    }));

    // Count conversations with unread messages
    const conversationsWithUnread = unreadDetails.filter(conv => conv.unreadCount > 0);

    return {
      totalUnreadConversations: conversationsWithUnread.length,
      totalConversations: conversations.length,
      conversations: unreadDetails,
    };
  }
}
