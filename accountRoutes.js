const express = require("express");
const mongoose = require("mongoose");
const accountRoutes = require("./accountRoutes");
const { authMiddleware } = require("./authMiddleware"); // Role-based access
const { Account,Transaction, Invoice } = require("./user"); // ✅ Correct
const path = require("path");
const puppeteer = require("puppeteer"); // ✅ For PDF Generation
const fs = require("fs");



const router = express.Router();
router.use(express.json());
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
router.post("/transactions", authMiddleware(["admin", "accountant"]), async (req, res) => {
  const { type, category, amount, tax_rate, payment_mode, account, date, description } = req.body;

  if (!type || !category || !amount || !payment_mode || !account) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ✅ Check if the account exists
    const foundAccount = await Account.findById(account).session(session);
    if (!foundAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    // ✅ Corrected GST Calculation
    let tax_amount = tax_rate > 0 ? (amount * tax_rate) / 100 : 0;
    let total_amount = amount + tax_amount; // Correct total amount

    // ✅ Create Transaction Entry (Fix amount field)
    const newTransaction = new Transaction({
      type,
      category,
      amount, // Store original amount
      tax_rate: tax_rate || 0,
      tax_amount,
      total: total_amount, // Store total amount after tax
      payment_mode,
      account,
      date: date || Date.now(),
      description,
      createdBy: req.user.id
    });

    await newTransaction.save({ session });

    // ✅ Update Account Balance Correctly
    if (type === "Income" || type === "Investment" || type === "Loan") {
      foundAccount.amount += total_amount;
    } else {
      foundAccount.amount -= total_amount;
    }
    await foundAccount.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Transaction recorded successfully",
      transaction: newTransaction
    });

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
  const { type, category, amount, tax_rate, payment_mode, date, description } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findById(req.params.id).session(session);
    if (!transaction || transaction.deleted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    const account = await Account.findById(transaction.account).session(session);
    if (!account) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    // ✅ Revert old transaction effect on balance
    if (transaction.type === "Income" || transaction.type === "Investment" || transaction.type === "Loan") {
      account.amount -= transaction.amount;
    } else {
      account.amount += transaction.amount;
    }

    // ✅ Recalculate GST if amount or tax_rate is updated
    let tax_amount = tax_rate !== undefined ? (amount * tax_rate) / 100 : transaction.tax_amount;
    let total_amount = amount !== undefined ? amount + tax_amount : transaction.amount;

    // ✅ Update transaction fields
    if (type) transaction.type = type;
    if (category) transaction.category = category;
    if (amount !== undefined) {
      transaction.amount = total_amount;
      transaction.tax_amount = tax_amount;
    }
    if (tax_rate !== undefined) transaction.tax_rate = tax_rate;
    if (payment_mode) transaction.payment_mode = payment_mode;
    if (date) transaction.date = date;
    if (description) transaction.description = description;

    await transaction.save({ session });

    // ✅ Apply new transaction effect on balance
    if (transaction.type === "Income" || transaction.type === "Investment" || transaction.type === "Loan") {
      account.amount += total_amount;
    } else {
      account.amount -= total_amount;
    }

    await account.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, message: "Transaction updated successfully", transaction });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating transaction:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
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
    const { invoiceNumber, customerName, customerEmail, items, paymentMethod } = req.body;

    let subTotal = 0;
    let taxTotal = 0;
    
    // ✅ Calculate GST for each item
    const updatedItems = items.map(item => {
      const taxAmount = (item.price * item.quantity * item.tax_rate) / 100;
      const totalPrice = item.price * item.quantity + taxAmount;

      subTotal += item.price * item.quantity;
      taxTotal += taxAmount;

      return { ...item, tax_amount: taxAmount, total: totalPrice };
    });

    const grandTotal = subTotal + taxTotal; // ✅ Final total including GST

    const newInvoice = new Invoice({
      invoiceNumber,
      customerName,
      customerEmail,
      items: updatedItems,
      subTotal,
      taxTotal,
      grandTotal,
      paymentMethod,
      createdBy: req.user.id
    });

    await newInvoice.save();
    res.status(201).json({ success: true, message: "Invoice created", invoice: newInvoice });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

// ✅ Get all invoices (Only Admins & Accountants)
router.get("/get_invoice", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const invoices = await Invoice.find().populate("createdBy", "name email");
    res.json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

// ✅ Get invoice by ID (Only Admins & Accountants)
router.get("/get_invoice/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("createdBy", "name email");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

// ✅ Update an invoice (Only Admins & Accountants)
router.put("/update_invoice/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate("createdBy", "name email role");
    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // ✅ Allowed fields for updates
    const allowedFields = ["customerName", "customerEmail", "items", "paymentMethod", "status"];
    const updates = {};

    for (let key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // ✅ Validate and recalculate GST if items are updated
    if (updates.items && Array.isArray(updates.items) && updates.items.length > 0) {
      let subTotal = 0;
      let taxTotal = 0;

      const updatedItems = updates.items.map(item => {
        const price = item.price || 0;
        const quantity = item.quantity || 0;
        const taxRate = item.tax_rate !== undefined ? item.tax_rate : 18; // Default GST 18%

        const itemTotal = price * quantity;
        const taxAmount = (itemTotal * taxRate) / 100;
        const totalPrice = itemTotal + taxAmount;

        subTotal += itemTotal;
        taxTotal += taxAmount;

        return { ...item, tax_amount: taxAmount, total: totalPrice };
      });

      updates.items = updatedItems;
      updates.subTotal = subTotal;
      updates.taxTotal = taxTotal;
      updates.grandTotal = subTotal + taxTotal; // ✅ Final invoice total including tax
    }

    // ✅ Apply updates if there are any
    if (Object.keys(updates).length > 0) {
      Object.assign(invoice, updates);
      invoice.updatedAt = Date.now(); // Update timestamp
      await invoice.save();
    }

    res.json({ 
      success: true, 
      message: "Invoice updated successfully", 
      invoice, 
      createdBy: invoice.createdBy // ✅ Include user details 
    });

  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
});





// ✅ Generate Invoice PDF (Only Admins & Accountants)


router.get("/invoice_pdf/:id", authMiddleware(["admin", "accountant"]), async (req, res) => {
  try {
    console.log("Fetching invoice for PDF...");

    const invoice = await Invoice.findById(req.params.id).populate("createdBy", "name email role");
    if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

    console.log("Invoice Data:", invoice);

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; }
            p { font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Invoice: ${invoice.invoiceNumber}</h1>
          <p><strong>Customer:</strong> ${invoice.customerName}</p>
          <p><strong>Email:</strong> ${invoice.customerEmail}</p> 
          <p><strong>Subtotal:</strong> $${(invoice.subTotal || 0).toFixed(2)}</p>
          <p><strong>Tax Total:</strong> $${(invoice.taxTotal || 0).toFixed(2)}</p>
          <p><strong>Grand Total:</strong> $${(invoice.grandTotal || 0).toFixed(2)}</p>
          <p><strong>Payment Method:</strong> ${invoice.paymentMethod}</p>
          <h3>Items</h3>
          <table>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Tax %</th>
              <th>Tax Amount</th>
              <th>Total</th>
            </tr>
            ${invoice.items
              .map(
                (item) =>
                  `<tr>
                    <td>${item.description || "N/A"}</td>
                    <td>${item.quantity || 0}</td>
                    <td>$${(item.price || 0).toFixed(2)}</td>
                    <td>${(item.tax_rate || 0).toFixed(2)}%</td>
                    <td>$${(item.tax_amount || 0).toFixed(2)}</td>
                    <td>$${(item.total || 0).toFixed(2)}</td>
                  </tr>`
              )
              .join("")}
          </table>
        </body>
      </html>
    `;

    await page.setContent(htmlContent);

    // ✅ Ensure directory exists
    const invoicesDir = path.join(__dirname, "../invoices");
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const pdfPath = path.join(invoicesDir, `invoice_${invoice._id}.pdf`);
    await page.pdf({ path: pdfPath, format: "A4" });

    await browser.close();

    // ✅ Send the generated PDF
    res.download(pdfPath, `invoice_${invoice.invoiceNumber}.pdf`, (err) => {
      if (err) {
        console.error("Error sending PDF:", err);
        res.status(500).json({ success: false, message: "Error sending PDF" });
      }
    });
  } catch (error) {
    console.error("PDF Generation Error:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
});






// ✅ Profit & Loss Report Route



router.get(
  "/profit-loss",
  authMiddleware(["admin", "accountant"]), // Restrict access to admin & accountant
  async (req, res) => {
    try {
      let { year, month } = req.query;
      const currentYear = new Date().getFullYear();
      year = year ? parseInt(year) : currentYear; // Default to current year

      let startDate, endDate;

      if (month) {
        // ✅ If a month is provided, calculate only for that month
        month = parseInt(month) - 1; // Convert to 0-based index
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0); // Last day of the month
      } else {
        // ✅ If no month is provided, calculate for the full year
        startDate = new Date(year, 0, 1); // Jan 1
        endDate = new Date(year, 11, 31); // Dec 31
      }

      // Fetch total income
      const totalIncome = await Transaction.aggregate([
        { $match: { type: "Income", date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      // Fetch total expenses
      const totalExpense = await Transaction.aggregate([
        { $match: { type: "Expense", date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      const income = totalIncome.length > 0 ? totalIncome[0].total : 0;
      const expenses = totalExpense.length > 0 ? totalExpense[0].total : 0;
      const profitOrLossAmount = income - expenses;

      // ✅ Determine the financial status
      let status;
      if (profitOrLossAmount > 0) {
        status = "Profit";
      } else if (profitOrLossAmount < 0) {
        status = "Loss";
      } else {
        status = "Break-even"; // ✅ No profit, no loss
      }

      res.json({
        year,
        month: month ? month + 1 : "Full Year",
        startDate,
        endDate,
        totalIncome: income,
        totalExpense: expenses,
        netProfitOrLoss: profitOrLossAmount,
        status // ✅ Explicitly indicate Profit/Loss/Break-even
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);


// ✅ Balance Sheet Report Route


router.get(
  "/balance-sheet",
  authMiddleware(["admin", "accountant"]), // Restrict access to admin & accountant
  async (req, res) => {
    try {
      // Fetch total Assets
      const totalAssets = await Account.aggregate([
        { $match: { type: "Asset" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      // Fetch total Liabilities
      const totalLiabilities = await Account.aggregate([
        { $match: { type: "Liability" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      // Fetch total Equity (Calculated as: Assets - Liabilities)
      const assets = totalAssets.length > 0 ? totalAssets[0].total : 0;
      const liabilities = totalLiabilities.length > 0 ? totalLiabilities[0].total : 0;
      const equity = assets - liabilities; // ✅ Equity Calculation

      res.json({
        totalAssets: assets,
        totalLiabilities: liabilities,
        totalEquity: equity
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);


///////////////////////////cash flow report////////////////////////

router.get(
  "/cash-flow",
  authMiddleware(["admin", "accountant"]), // Restrict to Admin & Accountant
  async (req, res) => {
    try {
      let { year, month } = req.query;
      const currentYear = new Date().getFullYear();
      year = year ? parseInt(year) : currentYear; // Default to current year

      let startDate, endDate;

      if (month) {
        // ✅ If month is provided, calculate for that month
        month = parseInt(month) - 1; // Convert to 0-based index
        startDate = new Date(year, month, 1);
        endDate = new Date(year, month + 1, 0);
      } else {
        // ✅ If no month, calculate for the full year
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
      }

      // Fetch Cash Inflows (Income)
      const totalCashInflow = await Transaction.aggregate([
        { $match: { type: "Income", date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      // Fetch Cash Outflows (Expenses)
      const totalCashOutflow = await Transaction.aggregate([
        { $match: { type: "Expense", date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);

      // Fetch Loan & Investment Transactions
      const totalFinancing = await Transaction.aggregate([
        { $match: { 
            type: { $in: ["Loan", "Investment"] }, 
            date: { $gte: startDate, $lte: endDate } 
          } 
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      
      

      const cashInflow = totalCashInflow.length > 0 ? totalCashInflow[0].total : 0;
      const cashOutflow = totalCashOutflow.length > 0 ? totalCashOutflow[0].total : 0;
      const financing = totalFinancing.length > 0 ? totalFinancing[0].total : 0;
      const netCashFlow = cashInflow - cashOutflow; // ✅ Net Cash Flow Calculation

      res.json({
        year,
        month: month ? month + 1 : "Full Year",
        startDate,
        endDate,
        totalCashInflow: cashInflow,
        totalCashOutflow: cashOutflow,
        financingActivities: financing,
        netCashFlow
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);



// ✅ GET Tax Report (GST on Sales & Purchases)
router.get("/tax_report", async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;

    // ✅ Filter by date range
    const filter = {};
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // ✅ Filter by payment method (optional)
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }

    // ✅ Fetch Transactions
    const transactions = await Transaction.find(filter);

    let gstOnSales = 0; // Output GST (Collected from customers)
    let gstOnPurchases = 0; // Input GST (Paid on expenses)

    transactions.forEach((txn) => {
      if (txn.type === "Income") {
        gstOnSales += txn.tax_amount;
      } else if (txn.type === "Expense") {
        gstOnPurchases += txn.tax_amount;
      }
    });

    // ✅ Calculate Net GST Payable or Refundable
    const netGST = gstOnSales - gstOnPurchases;

    res.json({
      success: true,
      report: {
        gstOnSales, // Output GST (Tax collected)
        gstOnPurchases, // Input GST (Tax paid)
        netGST, // Payable or refundable amount
      },
    });
  } catch (error) {
    console.error("Error generating tax report:", error);
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
});











module.exports = router;
