const chatModel = require('../models/chat.model');
const messageModel = require('../models/message.model');

async function createChat(req, res) {
    const { title } = req.body;

    const user = req.user;
    const chat = await chatModel.create({
        user: user._id,
        title: title
    })
    res.status(201).json({
        message: "Chat created successfully",
        chat: {
            _id: chat._id,
            title: chat.title,
            user: chat.user,
            lastActivity: chat.lastActivity
        }
    })
}

async function getUserChats(req, res) {
    try {
        const chats = await chatModel.find({ user: req.user._id }).sort({ updatedAt: -1 }).lean();
        res.status(200).json({ chats });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch chats" });
    }
}

async function getChatMessages(req, res) {
    try {
        const messages = await messageModel.find({ chat: req.params.chatId, user: req.user._id })
            .sort({ createdAt: 1 }).lean();
        res.status(200).json({ messages });
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch messages" });
    }
}

async function updateChatTitle(req, res) {
    try {
        const { title } = req.body;
        const chat = await chatModel.findOneAndUpdate(
            { _id: req.params.chatId, user: req.user._id },
            { title },
            { new: true }
        ).lean();
        if (!chat) return res.status(404).json({ message: "Chat not found" });
        res.status(200).json({ chat });
    } catch (err) {
        res.status(500).json({ message: "Failed to update chat title" });
    }
}

module.exports = { createChat, getUserChats, getChatMessages, updateChatTitle };