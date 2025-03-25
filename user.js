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


const TransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ["Income", "Expense", "Loan", "Investment"], required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  tax_rate: { type: Number, default: 0 },
  tax_amount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  payment_mode: { type: String, enum: ["Cash", "Card", "Bank"], required: true },
  account: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
  date: { type: Date, default: Date.now },
  description: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  deleted: { type: Boolean, default: false },
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", TransactionSchema);








// ✅ Invoice Model

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true }, // Unique Invoice ID
  customerName: { type: String, required: true }, // Customer's Name
  customerEmail: { type: String, required: true }, // Customer's Email
  items: [
    {
      description: { type: String, required: true }, // Item description
      quantity: { type: Number, required: true }, // Quantity purchased
      price: { type: Number, required: true }, // Unit price
      tax_rate: { type: Number, required: true, default: 18 }, // GST % (Default: 18%)
      tax_amount: { type: Number }, // GST Amount (Calculated)
      total: { type: Number } // Total price per item (Including GST)
    }
  ],
  subTotal: { type: Number }, // Total before tax (Calculated)
  taxTotal: { type: Number }, // Total GST amount (Calculated)
  grandTotal: { type: Number }, // Total invoice amount (incl. tax) (Calculated)
  status: { type: String, enum: ["Pending", "Paid"], default: "Pending" }, // Payment status
  paymentMethod: { type: String, enum: ["Cash", "Card", "Bank"], required: true }, // Payment type
  pdfPath: { type: String }, // Stores generated PDF file path
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now } // Invoice creation date
});

// ✅ Pre-save Middleware: Automatically Calculate Prices
InvoiceSchema.pre("save", function (next) {
  let subTotal = 0;
  let taxTotal = 0;

  this.items.forEach((item) => {
    item.price = item.price || 0; // Ensure price is a number
    item.quantity = item.quantity || 0; // Ensure quantity is a number
    item.tax_rate = item.tax_rate || 18; // Default GST rate

    const itemTotal = item.quantity * item.price;
    const taxAmount = (itemTotal * item.tax_rate) / 100;

    item.tax_amount = taxAmount;
    item.total = itemTotal + taxAmount;

    subTotal += itemTotal;
    taxTotal += taxAmount;
  });

  this.subTotal = subTotal || 0;
  this.taxTotal = taxTotal || 0;
  this.grandTotal = subTotal + taxTotal || 0;

  next();
});



const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema);



// ✅ Export all models correctly
module.exports = { User, Account, Transaction, Invoice };





