const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const chatController = require('../controllers/chat.controller');
router.post('/', authMiddleware, chatController.createChat);
router.get('/', authMiddleware, chatController.getUserChats);
router.get('/:chatId/messages', authMiddleware, chatController.getChatMessages);
router.patch('/:chatId/title', authMiddleware, chatController.updateChatTitle);


module.exports = router;