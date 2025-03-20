const mongoose = require("mongoose");

// ✅ User Model
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "accountant", "staff"], default: "staff" }
});
const User = mongoose.models.User || mongoose.model("User", UserSchema);

// ✅ Account Model
const AccountSchema = new mongoose.Schema({
  type: { type: String, enum: ["Asset", "Liability", "Income", "Expense"], required: true },
  name: { type: String, required: true, unique: true },
  amount: { type: Number, default: 0 },
  accountType: { type: String, enum: ["Sales Account", "Bank Account", "Expense Account", "Other"], required: true },
  createdAt: { type: Date, default: Date.now }
});
const Account = mongoose.models.Account || mongoose.model("Account", AccountSchema);

// ✅ Transaction Model
const TransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Income", "Expense"], required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    payment_mode: { type: String, enum: ["Cash", "Card", "Bank"], required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    date: { type: Date, default: Date.now },
    description: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deleted: { type: Boolean, default: false } // ✅ Soft delete functionality
  },
  { timestamps: true } // ✅ Auto `createdAt` & `updatedAt`
);
const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);

// ✅ Invoice Model
const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true }, // Unique Invoice ID
  customerName: { type: String, required: true }, // Customer's Name
  customerEmail: { type: String, required: true }, // Customer's Email
  items: [
    {
      description: String, // Item description
      quantity: Number, // Quantity purchased
      price: Number, // Unit price
      total: Number // Total price per item
    }
  ],
  totalAmount: { type: Number, required: true }, // Total invoice amount
  status: { type: String, enum: ["Pending", "Paid"], default: "Pending" }, // Payment status
  paymentMethod: { type: String, enum: ["Cash", "Card", "Bank"], required: true }, // Payment type
  pdfPath: { type: String }, // Stores generated PDF file path
  createdAt: { type: Date, default: Date.now } // Invoice creation date
});
const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);



// ✅ Export all models correctly
module.exports = { User, Account, Transaction, Invoice };





