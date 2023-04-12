const app = require('./app');
const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const User = require('./models/user');
const FriendRequest = require('./models/friendRequest');
const path = require('path');
const OneToOneMessage = require('./models/oneToOneMessage');

dotenv.config({ path: './config.env' });

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5000',
    methods: ['GET', 'POST'],
  },
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(err.name, err.message);
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  process.exit(1);
});

// Terminate the process if an unhandled rejection occurs
process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});

const DB = process.env.DB_URI.replace('<PASSWORD>', process.env.DB_PASSWORD);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('DB connection successful!');
  })
  .catch((err) => {
    console.log(err);
  });

const port = process.env.PORT || 5000;

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

io.on('connection', async (socket) => {
  console.log(JSON.stringify(socket.handshake.query));
  const userId = socket.handshake.query['userId'];
  const socketId = socket.id;

  console.log(`user ${userId} connected`);

  if (userId !== null && Boolean(userId)) {
    try {
      await User.findIdAndUpdate(userId, { socketId, status: 'online' });
    } catch (e) {
      console.log(e);
    }
  }

  socket.on('friend_request', async (data, callback) => {
    const toUser = await User.findById(data.to).select('socketId');
    const fromUser = await User.findById(data.from).select('socketId');

    await FriendRequest.create({
      sender: data.from,
      receiver: data.to,
    });

    io.to(toUser?.socketId).emit('new_friend_request', {
      message: 'New friend request received',
    });

    io.to(fromUser?.socketId).emit('friend_request_sent', {
      message: 'Friend request sent',
    });
  });

  socket.on('accept_request', async (data, callback) => {
    console.log(data);

    const requestDoc = await FriendRequest.findById(data.requestId);

    const sender = await User.findById(requestDoc.sender);
    const receiver = await User.findById(requestDoc.receiver);

    sender.friends.push(requestDoc.receiver);
    receiver.friends.push(requestDoc.sender);

    await receiver.save({ new: true, validateModifyOnly: true });
    await sender.save({ new: true, validateModifyOnly: true });

    await FriendRequest.findByIdAndDelete(data.requestId);

    io.to(sender?.socketId).emit('request_accepted', {
      message: 'Friend request accepted',
    });
    io.to(receiver?.socketId).emit('request_accepted', {
      message: 'Friend request accepted',
    });
  });

  socket.on('get_direct_conversatoins', async ({ userId }, callback) => {
    const existingConversations = await OneToOneMessage.find({
      participants: { $all: [userId] },
    }).populate({
      path: 'participants',
      select: 'firstName lastName _id, email status',
    });

    console.log(existingConversations);

    callback(existingConversations);
  });

  socket.on('start_conversation', async (data) => {
    const { to, from } = data;
    const existingConversations = await OneToOneMessage.find({
      participants: { $size: 2, $all: [to, from] },
    }).populate('participants', 'firstName lastName _id email status');

    console.log(`Existing conversation: ${existingConversations[0]}`);

    if (existingConversations.length === 0) {
      let newChat = await OneToOneMessage.create({
        participants: [to, from],
      });

      newChat = await OneToOneMessage.findById(newChat._id).populate(
        'participants',
        'firstName lastName _d email status'
      );
      console.log(newChat);
      socket.emit('start_chat', newChat);
    } else {
      socket.emit('open_chat', existingConversations[0]);
    }
  });

  socket.on('get_messages', async (data, callback) => {
    const { messages } = await OneToOneMessage.findById(
      data.conversationId
    ).select('messages');
    callback(messages);
  });

  socket.on('text_message', async (data, callback) => {
    console.log('Received text message', data);

    const { to, from, message, conversationId, type } = data;
    const toUser = await User.findById(to);
    const fromUser = await User.findById(from);

    const newMessage = {
      to,
      from,
      type,
      createdAt: Date.now(),
      text: message,
    };

    const chat = await OneToOneMessage.findByIdAndUpdate(conversationId);
    chat.messages.push(newMessage);
    await chat.save({ new: true, validateModifiedOnly: true });

    io.to(toUser.socketId).emit('new_message', {
      conversationId,
      message: newMessage,
    });

    io.to(fromUser.socketId).emit('new_message', {
      conversationId,
      message: newMessage,
    });
  });

  socket.on('document_message', async (data, callback) => {
    console.log('Received document message', data);

    // Get the file extension
    const fileExtension = path.extname(data.file.name);

    // Generate a unique file name
    const fileName = `${Date.now()}_${Math.floor(
      Math.random() * 10000
    )}${fileExtension}`;

    // Save the file to the server
  });

  socket.on('end', async (data) => {
    if (data.userId) {
      await User.findIdAndUpdate(data.userId, {
        socketId: null,
        status: 'offline',
      });
    }
    console.log('User disconnected');
    socket.disconnect(0);
  });
});
