const cron = require("node-cron");
const Cart = require("../models/cart");
const CartItem = require("../models/cartItem");

const cleanupCartItem = () => {
  return cron.schedule("0 0 * * *", async () => {
    console.log("Running cleanup job...");
    try {
      const cartIds = await Cart.distinct("_id");

      await CartItem.deleteMany({ cartId: { $nin: cartIds } });
    } catch (error) {
      console.error("Cleanup error:", error.message);
    }
  });
};

module.exports = cleanupCartItem;
