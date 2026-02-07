import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function initializeDatabase() {
  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export async function getAllConversations() {
  return await prisma.conversation.findMany({
    orderBy: {
      updatedAt: 'desc'
    },
    select: {
      id: true,
      title: true,
      model: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function getConversationById(id) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        include: {
          attachments: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      }
    }
  });
  return conversation;
}

export async function createConversation(dataOrId, title, model) {
  const data = typeof dataOrId === 'object'
    ? dataOrId
    : { title: title || 'New Conversation', model: model || 'glm-4.7-flash' };

  const conversation = await prisma.conversation.create({
    data: {
      title: data.title || 'New Conversation',
      model: data.model || 'glm-4.7-flash'
    },
    include: {
      messages: true
    }
  });

  return conversation;
}

export async function updateConversation(id, data) {
  const conversation = await prisma.conversation.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.model !== undefined && { model: data.model }),
      updatedAt: new Date()
    },
    include: {
      messages: {
        include: {
          attachments: true
        }
      }
    }
  });

  return conversation;
}

export async function deleteConversation(id) {
  try {
    await prisma.conversation.delete({
      where: { id }
    });
    return { success: true };
  } catch (error) {
    // P2025: Record not found - treat as success since conversation doesn't exist anyway
    if (error.code === 'P2025') {
      return { success: true };
    }
    throw error;
  }
}

export async function addMessage(conversationId, message) {
  const newMessage = await prisma.message.create({
    data: {
      conversationId,
      role: message.role,
      content: message.content,
      thinking: message.thinking || null,
      thinkingDuration: message.thinking_duration || null,
      ...(message.attachments && message.attachments.length > 0 && {
        attachments: {
          create: message.attachments.map(att => ({
            filename: att.filename,
            originalName: att.originalName,
            mimetype: att.mimetype,
            size: att.size,
            path: att.path || att.url || ''
          }))
        }
      })
    },
    include: {
      attachments: true
    }
  });

  // Update conversation timestamp
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  });

  return newMessage;
}

export async function deleteMessage(conversationId, messageId) {
  await prisma.message.delete({
    where: {
      id: messageId,
      conversationId
    }
  });
  return { success: true };
}

export async function deleteMessageAndSubsequent(conversationId, messageId) {
  await deleteMessage(conversationId, messageId);
  return true;
}

// Graceful shutdown
export async function disconnectDatabase() {
  await prisma.$disconnect();
}

export default prisma;
