let io;

const initSocket = (server) => {
  const { Server } = require("socket.io");
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected: ", socket.id);

    socket.on("disconnect", () => {
      console.log("Client disconnected: ", socket.id);
    });

    // 🧩 Khi client vào một board cụ thể
    socket.on("joinProduct", (productId) => {
      socket.join(productId); // Tham gia vào "phòng" theo boardId
      console.log(`User ${socket.id} joined product ${productId}`);
    });

    // 🧩 Khi client rời board
    socket.on("leaveProduct", (productId) => {
      socket.leave(productId);
      console.log(`User ${socket.id} left product ${productId}`);
    });

    // socket.on("newReview", (data) => {
    //   io.emit("newReview", data);
    // });

    // socket.on("newRating", (data) => {
    //   io.emit("newRating", data);
    // });
  });

  console.log("🚀 Socket.io initialized!");
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
