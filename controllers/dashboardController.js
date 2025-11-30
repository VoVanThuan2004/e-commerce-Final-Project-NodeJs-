const User = require("../models/user");
const Order = require("../models/order");
const OrderItem = require("../models/orderItem");
const Role = require("../models/role");
const OrderStatus = require("../constants/orderStatus");

const getDashboardBasic = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({
      status: "error",
      code: 403,
      message: "Không có quyền truy cập tài nguyên này",
    });
  }

  try {
    // 1. Lấy thông tin số lượng user (trừ admin)
    const role = await Role.findOne({ roleName: "ADMIN" });
    if (!role) {
      return res.status(404).json({
        status: "error",
        code: 404,
        message: "Vai trò không tồn tại",
      });
    }

    // Thực hiện song song lệnh query
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const days = 60;
    const limit = 5;

    const [totalUsers, totalNewUsers, totalOrders, totalRevenue, topProducts] =
      await Promise.all([
        User.countDocuments({ roleId: { $ne: role._id } }),
        User.countDocuments({
          createdAt: { $gte: oneWeekAgo },
          roleId: { $ne: role._id },
        }),
        Order.countDocuments({ currentStatus: "Đã nhận hàng"}),
        Order.aggregate([
          {
            $match: { currentStatus: "Đã nhận hàng" },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $subtract: ["$totalPrice", { $ifNull: ["$shippingFee", 0] }],
                },
              },
            },
          },
          {
            $project: {
              _id: 0,
              total: 1,
            },
          },
        ]),
        getTopSellingProductsByRevenue(days, limit),
      ]);

    const totalRevenueValue =
      totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    return res.status(200).json({
      status: "success",
      code: 200,
      message: "Lấy dữ liệu dashboard cơ bản thành công",
      data: {
        totalUsers,
        totalNewUsers,
        totalOrders,
        totalRevenue: totalRevenueValue,
        topProducts,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      code: 500,
      message: "Lỗi hệ thống: " + error.message,
    });
  }
};

async function getTopSellingProductsByRevenue(days = 30, limit = 5) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const topProducts = await OrderItem.aggregate([
    // 1. Join sang Order để lọc theo thời gian mua
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "orderInfo",
      },
    },
    { $unwind: "$orderInfo" }, // Giải nén mảng orderInfo

    // 2️. Lọc đơn hàng trong 30 ngày gần nhất (hoặc tùy chọn)
    {
      $match: {
        "orderInfo.purchaseTime": { $gte: startDate },
        "orderInfo.currentStatus": "Đã nhận hàng",
      },
    },

    // 3️. Gom nhóm theo productVariantId để tính doanh thu
    {
      $group: {
        _id: "$productVariantId",
        totalRevenue: { $sum: { $multiply: ["$price", "$quantity"] } },
        totalQuantity: { $sum: "$quantity" },
      },
    },

    // 4️. Sắp xếp theo doanh thu giảm dần
    { $sort: { totalRevenue: -1 } },

    // 5. Giới hạn số lượng kết quả (Top N)
    { $limit: limit },

    // 6️.Join sang ProductVariant để lấy thông tin sản phẩm
    {
      $lookup: {
        from: "productvariants",
        localField: "_id",
        foreignField: "_id",
        as: "variant",
      },
    },
    { $unwind: "$variant" },

    // 7️. Join sang Product để lấy tên sản phẩm cha (nếu cần)
    {
      $lookup: {
        from: "products",
        localField: "variant.productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },

    // 8️. Chọn trường cần thiết để trả về
    {
      $project: {
        _id: 0,
        productId: "$product._id",
        productName: "$product.name",
        variantId: "$variant._id",
        variantName: "$variant.name",
        totalRevenue: 1,
        totalQuantity: 1,
      },
    },
  ]);

  return topProducts;
}

const getDashboardAdvanced = async (req, res) => {
  const roleName = req.user.roleName;
  if (roleName !== "ADMIN") {
    return res.status(403).json({ status: "error", code: 403, message: "Không có quyền" });
  }

  const { type = "year", startDate, endDate } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ status: "error", code: 400, message: "Thiếu startDate hoặc endDate" });
  }

  const start = convertToVietNamTime(new Date(startDate));
  const end = convertToVietNamTime(new Date(endDate));
  end.setHours(23, 59, 59, 999);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return res.status(400).json({ status: "error", code: 400, message: "Khoảng thời gian không hợp lệ" });
  }

  try {
    // xác định key nhóm theo type
    let groupTimeId = {};
    switch (type) {
      case "week":
        groupTimeId = { year: { $year: "$purchaseTime" }, week: { $week: "$purchaseTime" } };
        break;
      case "month":
        groupTimeId = { year: { $year: "$purchaseTime" }, month: { $month: "$purchaseTime" } };
        break;
      case "quarter":
        groupTimeId = { year: { $year: "$purchaseTime" }, quarter: { $ceil: { $divide: [{ $month: "$purchaseTime" }, 3] } } };
        break;
      default:
        groupTimeId = { year: { $year: "$purchaseTime" } };
    }

    const pipeline = [
      // 1. Lọc orders trong khoảng và đã giao
      { $match: { currentStatus: OrderStatus.DELIVERIED, purchaseTime: { $gte: start, $lte: end } } },

      // 2. Lấy order items liên quan (Order -> OrderItem)
      {
        $lookup: {
          from: "orderitems",           // collection name (lowercase plural) — chỉnh nếu khác
          localField: "_id",
          foreignField: "orderId",
          as: "items"
        }
      },

      // 3. Bóc tách từng item để tính theo item
      { $unwind: "$items" },

      // 4. Lấy detail product variant (OrderItem -> ProductVariant)
      {
        $lookup: {
          from: "productvariants",
          localField: "items.productVariantId",
          foreignField: "_id",
          as: "variant"
        }
      },
      { $unwind: "$variant" },

      // 5. Lấy product từ variant (ProductVariant -> Product)
      {
        $lookup: {
          from: "products",
          localField: "variant.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },

      // 6. Lấy category từ product (Product -> Category)
      {
        $lookup: {
          from: "categories",
          localField: "product.categoryId",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },

      // 7. Tính toán cho mỗi item: doanh thu item, lợi nhuận item, tên category
      {
        $addFields: {
          itemRevenue: { $multiply: ["$items.price", "$items.quantity"] },
          // profit dùng sellingPrice - originalPrice của variant * quantity
          itemProfit: {
            $multiply: [
              { $subtract: ["$variant.sellingPrice", "$variant.originalPrice"] },
              "$items.quantity"
            ]
          },
          categoryName: "$category.categoryName",
          orderIdForSet: "$_id" // giữ order id để đếm distinct orders sau này
        }
      },

      // 8. Nhóm theo (time period + category) để có breakdown theo category trong mỗi period
      {
        $group: {
          _id: { ...groupTimeId, categoryName: "$categoryName" },
          ordersSet: { $addToSet: "$orderIdForSet" }, // để tính số đơn unique
          revenue: { $sum: "$itemRevenue" },
          profit: { $sum: "$itemProfit" },
          quantity: { $sum: "$items.quantity" }
        }
      },

      // 9. Gom lại theo period (tổng các category vào mảng categories), và ghép ordersSet arrays để đếm distinct orders
      {
        $group: {
          _id: {
            year: "$_id.year",
            month: "$_id.month",
            week: "$_id.week",
            quarter: "$_id.quarter"
          },
          categories: {
            $push: {
              categoryName: "$_id.categoryName",
              revenue: "$revenue",
              profit: "$profit",
              quantity: "$quantity"
            }
          },
          revenueTotal: { $sum: "$revenue" },
          profitTotal: { $sum: "$profit" },
          quantityTotal: { $sum: "$quantity" },
          ordersArrays: { $push: "$ordersSet" } // mảng các array orderId từ mỗi category
        }
      },

      // 10. Tạo danh sách orderId duy nhất bằng setUnion + reduce -> tính totalOrders
      {
        $addFields: {
          ordersUnion: {
            $reduce: {
              input: "$ordersArrays",
              initialValue: [],
              in: { $setUnion: ["$$value", "$$this"] }
            }
          },
          totalOrders: { $size: { $reduce: { input: "$ordersArrays", initialValue: [], in: { $setUnion: ["$$value", "$$this"] } } } }
        }
      },

      // 11. Tính số loại sản phẩm (unique categories) và project output
      {
        $addFields: {
          totalProductTypes: { $size: { $map: { input: "$categories", as: "c", in: "$$c.categoryName" } } }
        }
      },

      {
        $project: {
          _id: 0,
          period: "$_id",
          totalOrders: 1,
          totalRevenue: "$revenueTotal",
          totalProfit: "$profitTotal",
          totalProducts: "$quantityTotal",
          totalProductTypes: 1,
          categories: 1
        }
      },

      // 12. Sort theo thời gian
      { $sort: { "period.year": 1, "period.month": 1, "period.quarter": 1, "period.week": 1 } }
    ];

    const stats = await Order.aggregate(pipeline);

    // 13. Format label cho frontend
    const formatted = stats.map(s => {
      let label = "";
      if (s.period.week) label = `Tuần ${s.period.week} - ${s.period.year}`;
      else if (s.period.month) label = `Tháng ${s.period.month} - ${s.period.year}`;
      else if (s.period.quarter) label = `Quý ${s.period.quarter} - ${s.period.year}`;
      else label = `Năm ${s.period.year}`;

      return {
        label,
        totalOrders: s.totalOrders,
        totalRevenue: s.totalRevenue || 0,
        totalProfit: s.totalProfit || 0,
        totalProducts: s.totalProducts || 0,
        totalProductTypes: s.totalProductTypes || 0,
        categories: s.categories
      };
    });

    return res.status(200).json({ status: "success", code: 200, message: "Thống kê dashboard nâng cao", data: formatted });
  } catch (error) {
    return res.status(500).json({ status: "error", code: 500, message: "Lỗi hệ thống: " + error.message });
  }
};


// Hàm chuyển đổi sang giờ Việt Nam
const convertToVietNamTime = (date) => {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
};

module.exports = {
  getDashboardBasic,
  getDashboardAdvanced,
};
