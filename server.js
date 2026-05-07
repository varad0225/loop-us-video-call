const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://varadsingh0225_db_user:xBUVK953ae3Hnn3d@cluster0.0c0svac.mongodb.net/couples_call?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000
}).then(() => console.log('Connected to MongoDB Cloud/Local Database'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define User Schema
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: null },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const contactRequestSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

const ContactRequest = mongoose.model('ContactRequest', contactRequestSchema);

const JWT_SECRET = 'super-secret-romantic-key-123';

// Auth Routes
app.post('/api/register', async (req, res) => {
    try {
        const { name, username, password } = req.body;
        if (!name || !username || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, username, password: hashedPassword });
        await newUser.save();

        const token = jwt.sign({ id: newUser._id, username: newUser.username }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
        
        res.json({ message: 'Registered successfully', user: { id: newUser._id, name: newUser.name, username: newUser.username, profilePic: newUser.profilePic } });
    } catch (err) {
        console.error("Register Error:", err);
        res.status(500).json({ error: 'Server error during registration', details: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
        
        res.json({ message: 'Logged in successfully', user: { id: user._id, name: user.name, username: user.username, profilePic: user.profilePic } });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: 'Server error during login', details: err.message });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out' });
});

// Middleware for Protected Routes
const requireAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

app.get('/api/me', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(401).json({ error: 'User not found' });
        
        res.json({ user: { id: user._id, name: user.name, username: user.username, profilePic: user.profilePic } });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/me/profile', requireAuth, async (req, res) => {
    try {
        const { profilePic, name } = req.body;
        const updates = {};
        if (profilePic !== undefined) updates.profilePic = profilePic;
        if (name !== undefined) updates.name = name;
        
        const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
        res.json({ message: 'Profile updated', user: { id: user._id, name: user.name, username: user.username, profilePic: user.profilePic } });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// --- Contacts API ---

// Search users
app.get('/api/contacts/search', requireAuth, async (req, res) => {
    try {
        const { username } = req.query;
        if (!username) return res.json({ users: [] });
        
        // Find users matching search, excluding self
        const users = await User.find({ 
            $or: [
                { username: { $regex: username, $options: 'i' } },
                { name: { $regex: username, $options: 'i' } }
            ],
            _id: { $ne: req.userId }
        }).select('_id name username profilePic').limit(5);
        
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get my contacts & pending requests
app.get('/api/contacts', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).populate('contacts', '_id name username profilePic');
        const pendingRequests = await ContactRequest.find({ receiver: req.userId, status: 'pending' }).populate('sender', '_id name username profilePic');
        
        res.json({
            contacts: user.contacts,
            requests: pendingRequests
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch contacts' });
    }
});

// Send request
app.post('/api/contacts/request', requireAuth, async (req, res) => {
    try {
        const { receiverId } = req.body;
        if (receiverId === req.userId) return res.status(400).json({ error: 'Cannot add yourself' });

        const existingReq = await ContactRequest.findOne({ sender: req.userId, receiver: receiverId, status: 'pending' });
        if (existingReq) return res.status(400).json({ error: 'Request already sent' });

        const user = await User.findById(req.userId);
        if (user.contacts.includes(receiverId)) return res.status(400).json({ error: 'Already contacts' });

        const newReq = new ContactRequest({ sender: req.userId, receiver: receiverId });
        await newReq.save();
        
        // If receiver is online, we could notify via socket here, but standard polling/fetch on open is fine.
        // We will add real-time notification later.
        if (activeSockets.has(receiverId)) {
            io.to(activeSockets.get(receiverId)).emit('new_request');
        }

        res.json({ message: 'Request sent' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send request' });
    }
});

// Respond to request
app.post('/api/contacts/respond', requireAuth, async (req, res) => {
    try {
        const { requestId, action } = req.body; // action: 'accept' | 'reject'
        const contactReq = await ContactRequest.findOne({ _id: requestId, receiver: req.userId });
        
        if (!contactReq || contactReq.status !== 'pending') {
            return res.status(400).json({ error: 'Invalid request' });
        }

        if (action === 'accept') {
            contactReq.status = 'accepted';
            await User.findByIdAndUpdate(req.userId, { $addToSet: { contacts: contactReq.sender } });
            await User.findByIdAndUpdate(contactReq.sender, { $addToSet: { contacts: req.userId } });
        } else {
            contactReq.status = 'rejected';
        }
        
        await contactReq.save();
        
        if (action === 'accept' && activeSockets.has(contactReq.sender.toString())) {
            io.to(activeSockets.get(contactReq.sender.toString())).emit('request_accepted');
        }

        res.json({ message: `Request ${action}ed` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to respond to request' });
    }
});

// Store room states and user sockets
const rooms = new Map();
const activeSockets = new Map(); // maps userId to socket.id
const socketUsers = new Map(); // maps socket.id to userId

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Authenticate socket
    socket.on('authenticate', (userId) => {
        if (!userId) {
            console.log(`Socket ${socket.id} attempted to authenticate without a userId`);
            return;
        }
        console.log(`Socket ${socket.id} authenticated as user ${userId}`);
        activeSockets.set(userId, socket.id);
        socketUsers.set(socket.id, userId);
        socket.join(userId); // Join a personal room for direct routing
        
        // Notify contacts that user is online
        User.findById(userId).populate('contacts', '_id').then(user => {
            if (user && user.contacts) {
                user.contacts.forEach(contact => {
                    const contactSocketId = activeSockets.get(contact._id.toString());
                    if (contactSocketId) {
                        io.to(contactSocketId).emit('contact_online', userId);
                    }
                });
            }
        });
    });

    // Handle initiating a call
    socket.on('call_user', (data) => {
        const { targetUserId, roomId, callerInfo } = data;
        const targetSocketId = activeSockets.get(targetUserId);
        
        console.log(`Call initiated by user ${callerInfo.name} -> target ${targetUserId} in room ${roomId}`);
        
        if (targetSocketId) {
            console.log(`Forwarding incoming call to socket ${targetSocketId}`);
            io.to(targetSocketId).emit('incoming_call', {
                roomId,
                callerInfo
            });
        } else {
            console.log(`Failed to forward call: Target user ${targetUserId} is offline or not authenticated`);
            socket.emit('call_failed', { reason: 'User is currently offline' });
        }
    });

    socket.on('reject_call', (data) => {
        const { callerId } = data;
        const callerSocketId = activeSockets.get(callerId);
        if (callerSocketId) {
            io.to(callerSocketId).emit('call_rejected');
        }
    });

    // Join a room
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);

        // Notify others in the room
        socket.to(roomId).emit('user_joined', socket.id);

        // Keep track of users in the room
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);
    });

    // WebRTC Signaling
    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data.answer);
    });

    socket.on('ice_candidate', (data) => {
        socket.to(data.roomId).emit('ice_candidate', data.candidate);
    });

    // Mutual End Call Logic
    socket.on('request_end_call', (roomId) => {
        console.log(`User ${socket.id} requested to end call in room ${roomId}`);
        socket.to(roomId).emit('end_call_requested');
    });

    socket.on('accept_end_call', (roomId) => {
        console.log(`User ${socket.id} accepted to end call in room ${roomId}. Initiating game challenge.`);
        // Instead of ending call, we initiate the game challenge phase.
        // User A (the one who requested) should see "waiting for challenge"
        // User B (the one who clicked accept) should see "game selection"
        socket.to(roomId).emit('challenge_initiated');
        socket.emit('select_game_challenge');
    });

    socket.on('decline_end_call', (roomId) => {
        console.log(`User ${socket.id} declined to end call in room ${roomId}`);
        socket.to(roomId).emit('end_call_declined');
    });

    // Game Events
    socket.on('game_selected', (data) => {
        io.to(data.roomId).emit('start_game', data.gameId);
    });

    socket.on('game_action', (data) => {
        // Broadcast action to the other player
        socket.to(data.roomId).emit('game_action', data.action);
    });

    socket.on('game_result', (data) => {
        io.to(data.roomId).emit('game_result', data);
    });

    socket.on('final_end_call', (roomId) => {
        io.to(roomId).emit('call_ended');
        if (rooms.has(roomId)) {
            rooms.delete(roomId);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        const userId = socketUsers.get(socket.id);
        if (userId) {
            activeSockets.delete(userId);
            socketUsers.delete(socket.id);
            
            // Notify contacts that user went offline
            User.findById(userId).populate('contacts', '_id').then(user => {
                if (user && user.contacts) {
                    user.contacts.forEach(contact => {
                        const contactSocketId = activeSockets.get(contact._id.toString());
                        if (contactSocketId) {
                            io.to(contactSocketId).emit('contact_offline', userId);
                        }
                    });
                }
            });
        }

        // Remove user from any rooms they were in
        for (const [roomId, users] of rooms.entries()) {
            if (users.has(socket.id)) {
                users.delete(socket.id);
                socket.to(roomId).emit('user_disconnected', socket.id);
                if (users.size === 0) {
                    rooms.delete(roomId);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
