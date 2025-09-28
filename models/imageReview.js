const mongoose = require("mongoose");

const imageReviewSchema = new mongoose.Schema({
  reviewId: {
    type: mongoose.Types.ObjectId,
    ref: "Review",
    required: true,
    index: true,
  },
  imageUrl: { type: String },
  imageUrlPublicId: { type: String }
});

module.exports = mongoose.model("ImageReview", imageReviewSchema);
