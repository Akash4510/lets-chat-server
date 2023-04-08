const app = require('./app');
const http = require('http');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const User = require('./models/user');
const FriendRequest = require('./models/friendRequest');

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
  const userId = socket.handshake.query['user_id'];
  const socketId = socket.id;

  console.log(`user ${userId} connected`);

  if (Boolean(userId)) {
    await User.findIdAndUpdate(userId, { socketId });
  }

  socket.on('friend_request', async (data, callback) => {
    console.log(data.to);

    const toUser = await User.findById(data.to).select('socket_id');
    const fromUser = await User.findById(data.from).select('socket_id');

    await FriendRequest.create({
      sender: data.from,
      receiver: data.to,
    });

    io.to(to.socketId).emit('new_friend_request', {
      message: 'New friend request received',
    });

    io.to(fromUser.socketId).emit('request-received', {
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

    io.to(sender.socketId).emit('request-accepted', {
      message: 'Friend request accepted',
    });
    io.to(receiver.socketId).emit('request-accepted', {
      message: 'Friend request accepted',
    });
  });

  socket.on('end', () => {
    console.log('User disconnected');
  });
});
