let io;

const initSocket = (server) => {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected: ", socket.id);

    socket.on("disconnect", () => {
      console.log("Client disconnected: ", socket.id);
    });

    socket.on("newReview", (data) => {
      io.emit("newReview", data);
    });

    socket.on("newRating", (data) => {
      io.emit("newRating", data);
    });
  });
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io chưa được khởi tạo!");
  }
  return io;
};

module.exports = {
  initSocket,
  getIO,
};
