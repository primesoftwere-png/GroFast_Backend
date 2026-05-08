// Updated Backend Model (product.model.js)
const mongoose = require("mongoose");

const productSchema = mongoose.Schema({
    productCode: {
        type: String,
        unique: true,
        required: true,
    },
    productName: {
        type: String,
        required: true,
    },
    productDescription: {
        type: String,
        required: true,
    },
    productPrice: {
        type: Number,
        required: true,
    },
    productImage: {
        type: String,
        required: true,
    },
    productCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category", // ✅ Use registered model name
        required: true,
    },
    productQuantity: {
        type: Number,
        required: true,
    },
    productUnit: { // Updated with all units from image
        type: String,
        enum: [
            'Kilogram (kg)', 'kg',
            'Gram (g)', 'g',
            'Liter (L)', 'L', 'liter',
            'Milliliter (ml)', 'ml',
            'Piece', 'piece',
            'Packet', 'packet',
            'Bottle', 'bottle',
            'Box', 'box',
            'Dozen', 'dozen',
            'Bunch', 'bunch',
            'Can', 'can',
            'Pack', 'pack'
        ],
        required: true,
    },
    productRating: {
        type: Number,
        default: 0,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // ✅ Use registered model name
        required: true,
    },
    productReviews: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User", // ✅ Use registered model name
            },
            reviewText: {
                type: String,
                required: true,
            },
            rating: {
                type: Number,
                required: true,
            },
        },
    ],
},{ timestamps: true });

const productModel = mongoose.models.product || mongoose.model("product", productSchema);

module.exports = productModel;