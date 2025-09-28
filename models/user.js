const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role',
            required: true,
            index: true
        },
        email: { type: String, required: true, index: true },
        fullName: { type: String },
        password: { type: String },
        gender: { type: Number },
        avatar: { type: String, default: null },
        avatarPublicId: { type: String, default: null },
        phoneNumber: { type: String, default: null },
        loyaltyPoints: { type: Number, default: 0 },
        isActive: { type: Boolean, required: true },
        reset_otp: { type: String, default: null },
        reset_otp_expired: { type: Date, default: null }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('User', userSchema);