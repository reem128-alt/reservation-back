import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Patch,
  ParseIntPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ConversationQueryDto } from './dto/conversation-query.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  async sendMessage(@Request() req, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(req.user.id, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiResponse({ status: 200, description: 'Returns all conversations' })
  async getConversations(@Request() req, @Query() query: ConversationQueryDto) {
    const isAdmin = req.user.role === 'ADMIN';
    return this.chatService.getConversations(req.user.id, isAdmin, query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a specific conversation' })
  @ApiResponse({ status: 200, description: 'Returns conversation details' })
  async getConversation(@Request() req, @Param('id', ParseIntPipe) id: number) {
    console.log('[ChatController] getConversation - req.user:', req.user);
    const isAdmin = req.user.role === 'ADMIN';
    console.log('[ChatController] isAdmin:', isAdmin);
    return this.chatService.getConversation(id, req.user.id, isAdmin);
  }

  @Get('conversations/user/:userId')
  @ApiOperation({ summary: 'Get conversation with a specific user' })
  @ApiResponse({ status: 200, description: 'Returns conversation with the user' })
  @ApiResponse({ status: 404, description: 'No conversation found' })
  async getConversationByUserId(@Request() req, @Param('userId', ParseIntPipe) userId: number) {
    console.log('[ChatController] getConversationByUserId - req.user:', req.user);
    const isAdmin = req.user.role === 'ADMIN';
    console.log('[ChatController] isAdmin:', isAdmin);
    return this.chatService.getConversationByUserId(userId, req.user.id, isAdmin);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiResponse({ status: 200, description: 'Returns all messages in conversation' })
  async getMessages(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const isAdmin = req.user.role === 'ADMIN';
    return this.chatService.getMessages(id, req.user.id, isAdmin);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.chatService.markMessagesAsRead(id, req.user.id);
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Update conversation status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Conversation updated' })
  async updateConversation(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConversationDto,
  ) {
    const isAdmin = req.user.role === 'ADMIN';
    return this.chatService.updateConversationStatus(id, req.user.id, isAdmin, dto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread conversations count' })
  @ApiResponse({ status: 200, description: 'Returns unread count' })
  async getUnreadCount(@Request() req) {
    const isAdmin = req.user.role === 'ADMIN';
    return this.chatService.getUnreadCount(req.user.id, isAdmin);
  }

  @Get('unread-details')
  @ApiOperation({ summary: 'Get unread count per conversation (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns detailed unread information' })
  async getUnreadDetails(@Request() req) {
    const isAdmin = req.user.role === 'ADMIN';
    if (!isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }
    return this.chatService.getUnreadDetails(req.user.id);
  }
}
