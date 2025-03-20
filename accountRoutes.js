const express = require("express");
const mongoose = require("mongoose");
const accountRoutes = require("./accountRoutes");
const { authMiddleware } = require("./authMiddleware"); // Role-based access
const { Account,Transaction, Invoice } = require("./user"); // ✅ Correct
const path = require("path");
const puppeteer = require("puppeteer"); // ✅ For PDF Generation
const fs = require("fs");



const router = express.Router();

/**
 * ✅ Create a new financial account (Asset, Liability, Income, Expense)
 * 🔒 Access: Only Admin & Accountant
 */
router.post("/accounts", authMiddleware(["admin", "accountant"]), async (req, res) => {
  const { type, name, amount, accountType } = req.body; 

  if (!type || !name || amount === undefined || !accountType) { 
    return res.status(400).json({ success: false, message: "Missing required fields: type, name, amount, or accountType" });
  }

  try {
    const existingAccount = await Account.findOne({ name });
    if (existingAccount) {
      return res.status(400).json({ message: "Account with this name already exists" });
    }

    const newAccount = new Account({ type, name, amount, accountType });
    await newAccount.save();

    res.status(201).json({ success: true, message: "Account created successfully", account: newAccount });
  } catch (error) {
    console.error("Error creating account:", error.message);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
});



/**
 * ✅ Get all accounts
 * 🔒 Access: Only Admin & Accountant
 */
router.get("/getaccount", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const accounts = await Account.find();
    res.json({ success: true, accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

/**
 * ✅ Get a single account by ID
 * 🔒 Access: Only Admin & Accountant
 */
router.get("/getaccount/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.json({ success: true, account });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

/**
 * ✅ Update an account (Only amount can be updated)
 * 🔒 Access: Only Admin & Accountant
 */
router.put("/updateaccount/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  const { name, amount, type } = req.body;

  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: "Account not found" });

    if (name) account.name = name; // Allow updating name
    if (amount !== undefined) account.amount = amount; // Allow updating amount
    if (type) account.type = type; // Allow updating type

    await account.save();

    res.json({ success: true, message: "Account updated successfully", account });
  } catch (error) {
    console.error("Error updating account:", error);
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});




  // ✅ Delete an account

router.delete("/:id", authMiddleware(["admin"]), async (req, res) => {
  try {
    const account = await Account.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Account not found" });

    // ✅ Check if account has transactions
    const transactions = await Transaction.find({ account: account._id });
    if (transactions.length > 0) {
      return res.status(400).json({ message: "Cannot delete account linked to transactions" });
    }

    await Account.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});



/**
 * ✅ Create a new transaction
 * 🔒 Access: Only Admin & Accountant
 */
router.post("/transaction", authMiddleware(["admin", "accountant"]), async (req, res) => {
  const { type, category, amount, payment_mode, account, date, description } = req.body;

  if (!type || !category || !amount || !payment_mode || !account) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const foundAccount = await Account.findById(account).session(session);
    if (!foundAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    const newTransaction = new Transaction({
      type,
      category,
      amount,
      payment_mode,
      account,
      date: date || Date.now(),
      description,
      createdBy: req.user.id
    });

    await newTransaction.save({ session });

    // ✅ Update Account Balance based on Transaction Type
    if (type === "Income") {
      foundAccount.amount += amount;
    } else {
      foundAccount.amount -= amount;
    }
    await foundAccount.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, message: "Transaction recorded successfully", transaction: newTransaction });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating transaction:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
});

/**
 * ✅ Get all transactions
 * 🔒 Access: Admin & Accountant
 */
router.get("/getall", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const transactions = await Transaction.find({ deleted: false })
      .populate("account createdBy", "name email")
      .sort({ date: -1 });

    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

/**
 * ✅ Get a single transaction by ID
 * 🔒 Access: Admin & Accountant
 */
router.get("/getid/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("account createdBy", "name email");
    
    if (!transaction || transaction.deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    res.json({ success: true, transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

/**
 * ✅ Update a transaction
 * 🔒 Access: Admin & Accountant
 */
router.put("/updatetransaction/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  const { type, category, amount, payment_mode, date, description } = req.body;

  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction || transaction.deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (type) transaction.type = type;
    if (category) transaction.category = category;
    if (amount !== undefined) transaction.amount = amount;
    if (payment_mode) transaction.payment_mode = payment_mode;
    if (date) transaction.date = date;
    if (description) transaction.description = description;

    await transaction.save();
    res.json({ success: true, message: "Transaction updated successfully", transaction });
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

/**
 * ✅ Soft Delete a transaction
 * 🔒 Access: Admin
 */
router.delete("/deletetransaction/:id", authMiddleware(["admin"]), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction || transaction.deleted) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    transaction.deleted = true;
    await transaction.save();

    res.json({ success: true, message: "Transaction deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});



/////////////////////////invoice////////////////////////




// ✅ Create a new invoice (Only Admins & Accountants)
router.post("/createinvoice", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const { invoiceNumber, customerName, customerEmail, items, totalAmount, paymentMethod } = req.body;

    const newInvoice = new Invoice({
      invoiceNumber,
      customerName,
      customerEmail,
      items,
      totalAmount,
      paymentMethod,
      createdBy: req.user.id, // Track who created the invoice
    });

    await newInvoice.save();
    res.status(201).json({ success: true, message: "Invoice created", invoice: newInvoice });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

// ✅ Get all invoices (Only Admins & Accountants)
router.get("/", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const invoices = await Invoice.find().populate("createdBy", "name email");
    res.json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

// ✅ Get invoice by ID (Only Admins & Accountants)
router.get("/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("createdBy", "name email");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

// ✅ Update an invoice (Only Admins & Accountants)
router.put("/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    Object.assign(invoice, req.body);
    await invoice.save();

    res.json({ success: true, message: "Invoice updated", invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

// ✅ Generate Invoice PDF (Only Admins & Accountants)
router.get("/pdf/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const htmlContent = `
      <h1>Invoice: ${invoice.invoiceNumber}</h1>
      <p><strong>Customer:</strong> ${invoice.customerName}</p>
      <p><strong>Email:</strong> ${invoice.customerEmail}</p>
      <p><strong>Total Amount:</strong> $${invoice.totalAmount}</p>
      <p><strong>Payment Method:</strong> ${invoice.paymentMethod}</p>
    `;

    await page.setContent(htmlContent);
    const pdfPath = path.join(__dirname, `../invoices/invoice_${invoice._id}.pdf`);
    await page.pdf({ path: pdfPath, format: "A4" });

    await browser.close();

    res.download(pdfPath);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});









module.exports = router;
