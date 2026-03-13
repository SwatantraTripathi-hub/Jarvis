const chatModel = require('../models/chat.model');
const messageModel = require('../models/message.model');

function safeDecodeBuffer(buffer) {
    if (!buffer) return '';
    const text = buffer.toString('utf8');
    return text.replace(/\u0000/g, '').trim();
}

function summarizeFile(file) {
    const raw = safeDecodeBuffer(file?.buffer);
    if (!raw) {
        return {
            fileName: file?.originalname || 'unknown',
            content: '',
            chars: 0,
            skipped: true,
            reason: 'File is empty or unreadable as UTF-8 text',
        };
    }

    const clipped = raw.slice(0, 6000);
    return {
        fileName: file?.originalname || 'unknown',
        content: clipped,
        chars: clipped.length,
        skipped: false,
    };
}

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

async function uploadContextFiles(req, res) {
    try {
        const files = Array.isArray(req.files) ? req.files : [];
        if (!files.length) {
            return res.status(400).json({ message: 'No files were uploaded' });
        }

        const parsed = files.map(summarizeFile);
        const usable = parsed.filter((f) => !f.skipped && f.content);

        if (!usable.length) {
            return res.status(400).json({
                message: 'No readable text found in uploaded files',
                files: parsed,
            });
        }

        return res.status(200).json({
            message: 'Files processed successfully',
            files: parsed,
            combinedContext: usable
                .map((f) => `FILE: ${f.fileName}\n${f.content}`)
                .join('\n\n-----\n\n')
                .slice(0, 14000),
        });
    } catch (error) {
        console.error('uploadContextFiles error:', error.message);
        return res.status(500).json({ message: 'Failed to process uploaded files' });
    }
}

module.exports = { createChat, getUserChats, getChatMessages, updateChatTitle, uploadContextFiles };