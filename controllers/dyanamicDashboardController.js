// controllers/dashboardController.js
import SalesPayment from "../models/SalesPayment.js";
import SalesInvoice from "../models/SalesInvoice.js";

/**
 * Get dashboard summary metrics
 * GET /api/dashboard/summary
 * Query params: startDate, endDate, search
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const { startDate, endDate, search } = req.query;
    const organizationId = req.user.organizationId;

    // Build match object
    const match = { organizationId };
    
    // Add date range filter
    if (startDate && endDate) {
      match.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    // Add search filter
    if (search) {
      match.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerGSTIN: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await SalesInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalOrders: { $sum: 1 },
          totalReceived: { $sum: "$paidAmount" },
          totalPending: { $sum: "$outstandingAmount" },
        },
      },
    ]);

    res.json({
      success: true,
      data: result[0] || {
        totalSales: 0,
        totalOrders: 0,
        totalReceived: 0,
        totalPending: 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get paginated sales invoices
 * GET /api/dashboard/sales
 * Query params: startDate, endDate, customerId, status, search, page, limit
 */
export const getDashboardSales = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      customerId,
      status,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const organizationId = req.user.organizationId;
    const skip = (page - 1) * limit;

    // Build match object
    const match = { organizationId };
    
    if (customerId) match.customer_id = customerId;
    if (status) match.paymentStatus = status;
    
    // Add date range filter
    if (startDate && endDate) {
      match.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    // Add search filter
    if (search) {
      match.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerGSTIN: { $regex: search, $options: 'i' } }
      ];
    }

    const [sales, total] = await Promise.all([
      SalesInvoice.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SalesInvoice.countDocuments(match),
    ]);

    // Get summary for filtered data
    const summary = await SalesInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalPaid: { $sum: "$paidAmount" },
          totalPending: { $sum: "$outstandingAmount" },
          avgOrderValue: { $avg: "$grandTotal" }
        }
      }
    ]);

    res.json({
      success: true,
      data: sales,
      summary: summary[0] || {
        totalSales: 0,
        totalPaid: 0,
        totalPending: 0,
        avgOrderValue: 0
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get paginated payments
 * GET /api/dashboard/payments
 * Query params: startDate, endDate, customerId, search, page, limit
 */
export const getDashboardPayments = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      customerId,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const organizationId = req.user.organizationId;
    const skip = (page - 1) * limit;

    // Build match object for payments
    const paymentMatch = { organizationId };
    
    if (customerId) paymentMatch.customer_id = customerId;
    
    if (startDate && endDate) {
      paymentMatch.receivedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // If search is provided, first find matching invoices
    let invoiceIds = [];
    if (search) {
      const matchingInvoices = await SalesInvoice.find({
        organizationId,
        $or: [
          { customerName: { $regex: search, $options: 'i' } },
          { invoiceNumber: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      invoiceIds = matchingInvoices.map(inv => inv._id);
      if (invoiceIds.length > 0) {
        paymentMatch.invoice_id = { $in: invoiceIds };
      } else {
        // No matching invoices, return empty result
        return res.json({
          success: true,
          data: [],
          summary: { totalReceived: 0 },
          pagination: {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: 0
          }
        });
      }
    }

    const [payments, total] = await Promise.all([
      SalesPayment.find(paymentMatch)
        .populate('invoice_id', 'invoiceNumber customerName')
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SalesPayment.countDocuments(paymentMatch),
    ]);

    const summary = await SalesPayment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          totalReceived: { $sum: "$amount" },
          totalPayments: { $sum: 1 },
          avgPayment: { $avg: "$amount" }
        },
      },
    ]);

    res.json({
      success: true,
      data: payments,
      summary: {
        totalReceived: summary[0]?.totalReceived || 0,
        totalPayments: summary[0]?.totalPayments || 0,
        avgPayment: summary[0]?.avgPayment || 0
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get customer dashboard with invoices
 * GET /api/dashboard/customers/:id
 * Query params: startDate, endDate, search, page, limit
 */
export const getCustomerDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      startDate,
      endDate,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const organizationId = req.user.organizationId;
    const skip = (page - 1) * limit;

    // Build match object for customer
    const match = {
      organizationId,
      customer_id: id,
    };
    
    // Add date range filter
    if (startDate && endDate) {
      match.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    // Add search filter within customer's invoices
    if (search) {
      match.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'items.description': { $regex: search, $options: 'i' } }
      ];
    }

    const [summary, invoices, total] = await Promise.all([
      // Customer summary with payment breakdown
      SalesInvoice.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$customer_id",
            totalOrders: { $sum: 1 },
            totalSpent: { $sum: "$grandTotal" },
            totalPaid: { $sum: "$paidAmount" },
            totalPending: { $sum: "$outstandingAmount" },
            avgOrderValue: { $avg: "$grandTotal" }
          },
        },
      ]),

      // Paginated invoices
      SalesInvoice.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      // Total count for pagination
      SalesInvoice.countDocuments(match),
    ]);

    // Get payment history for this customer
    const paymentHistory = await SalesPayment.find({
      organizationId,
      customer_id: id
    })
      .sort({ receivedAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        summary: summary[0] || {
          totalOrders: 0,
          totalSpent: 0,
          totalPaid: 0,
          totalPending: 0,
          avgOrderValue: 0
        },
        invoices,
        paymentHistory
      },
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get dashboard insights with search
 * GET /api/dashboard/insights
 * Query params: search, startDate, endDate
 */
export const getDashboardInsights = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const { search, startDate, endDate } = req.query;

    // Build match object
    const match = { organizationId };
    
    // Add date range filter
    if (startDate && endDate) {
      match.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    
    // Add search filter
    if (search) {
      match.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerGSTIN: { $regex: search, $options: 'i' } }
      ];
    }

    // Get top customer from filtered data
    const topCustomer = await SalesInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$customerName",
          total: { $sum: "$grandTotal" },
          orderCount: { $sum: 1 }
        },
      },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]);

    // Get highest sale from filtered data
    const highestSale = await SalesInvoice.findOne(match)
      .sort({ grandTotal: -1 });

    // Get pending invoices count from filtered data
    const pendingCount = await SalesInvoice.countDocuments({
      ...match,
      outstandingAmount: { $gt: 0 },
    });

    // Get payment status breakdown
    const statusBreakdown = await SalesInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$outstandingAmount" }
        }
      }
    ]);

    // Get monthly trend for filtered data
    const monthlyTrend = await SalesInvoice.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        topCustomer: topCustomer[0] || null,
        highestSale: highestSale || null,
        pendingInvoices: pendingCount,
        statusBreakdown,
        monthlyTrend,
        filters: {
          search: search || null,
          startDate: startDate || null,
          endDate: endDate || null
        }
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// // controllers/dashboardController.js
// import SalesPayment from "../models/SalesPayment.js";
// import SalesInvoice from "../models/SalesInvoice.js";

// export const getDashboardSummary = async (req, res) => {
//   try {
//     const { startDate, endDate } = req.query;
//     const organizationId = req.user.organizationId;

//     const match = {
//       organizationId,
//       ...(startDate && endDate && {
//         createdAt: {
//           $gte: new Date(startDate),
//           $lte: new Date(endDate),
//         },
//       }),
//     };

//     const result = await SalesInvoice.aggregate([
//       { $match: match },
//       {
//         $group: {
//           _id: null,
//           totalSales: { $sum: "$grandTotal" },
//           totalOrders: { $sum: 1 },
//           totalReceived: { $sum: "$paidAmount" },
//           totalPending: { $sum: "$outstandingAmount" },
//         },
//       },
//     ]);

//     res.json({
//       success: true,
//       data: result[0] || {
//         totalSales: 0,
//         totalOrders: 0,
//         totalReceived: 0,
//         totalPending: 0,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
// export const getDashboardSales = async (req, res) => {
//   try {
//     const {
//       startDate,
//       endDate,
//       customerId,
//       status,
//       page = 1,
//       limit = 10,
//     } = req.query;

//     const organizationId = req.user.organizationId;

//     const skip = (page - 1) * limit;

//     const match = {
//       organizationId,
//       ...(customerId && { customer_id: customerId }),
//       ...(status && { paymentStatus: status }),
//       ...(startDate &&
//         endDate && {
//           createdAt: {
//             $gte: new Date(startDate),
//             $lte: new Date(endDate),
//           },
//         }),
//     };

//     const [sales, total] = await Promise.all([
//       SalesInvoice.find(match)
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(Number(limit)),

//       SalesInvoice.countDocuments(match),
//     ]);

//     res.json({
//       success: true,
//       data: sales,
//       pagination: {
//         total,
//         page: Number(page),
//         limit: Number(limit),
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
// export const getDashboardPayments = async (req, res) => {
//   try {
//     const {
//       startDate,
//       endDate,
//       customerId,
//       page = 1,
//       limit = 10,
//     } = req.query;

//     const organizationId = req.user.organizationId;

//     const skip = (page - 1) * limit;

//     const match = {
//       organizationId,
//       ...(customerId && { customer_id: customerId }),
//       ...(startDate &&
//         endDate && {
//           receivedAt: {
//             $gte: new Date(startDate),
//             $lte: new Date(endDate),
//           },
//         }),
//     };

//     const [payments, total] = await Promise.all([
//       SalesPayment.find(match)
//         .sort({ receivedAt: -1 })
//         .skip(skip)
//         .limit(Number(limit)),

//       SalesPayment.countDocuments(match),
//     ]);

//     const summary = await SalesPayment.aggregate([
//       { $match: match },
//       {
//         $group: {
//           _id: null,
//           totalReceived: { $sum: "$amount" },
//         },
//       },
//     ]);

//     res.json({
//       success: true,
//       data: payments,
//       summary: {
//         totalReceived: summary[0]?.totalReceived || 0,
//       },
//       pagination: {
//         total,
//         page: Number(page),
//         limit: Number(limit),
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };
// export const getCustomerDashboard = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const {
//       startDate,
//       endDate,
//       page = 1,
//       limit = 10,
//     } = req.query;

//     const organizationId = req.user.organizationId;
//     const skip = (page - 1) * limit;

//     const match = {
//       organizationId,
//       customer_id: id,
//       ...(startDate &&
//         endDate && {
//           createdAt: {
//             $gte: new Date(startDate),
//             $lte: new Date(endDate),
//           },
//         }),
//     };

//     const [summary, invoices, total] = await Promise.all([
//       SalesInvoice.aggregate([
//         { $match: match },
//         {
//           $group: {
//             _id: "$customer_id",
//             totalOrders: { $sum: 1 },
//             totalSpent: { $sum: "$grandTotal" },
//             totalPending: { $sum: "$outstandingAmount" },
//           },
//         },
//       ]),

//       SalesInvoice.find(match)
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(Number(limit)),

//       SalesInvoice.countDocuments(match),
//     ]);

//     res.json({
//       success: true,
//       data: {
//         summary: summary[0] || {
//           totalOrders: 0,
//           totalSpent: 0,
//           totalPending: 0,
//         },
//         invoices,
//       },
//       pagination: {
//         total,
//         page: Number(page),
//         limit: Number(limit),
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// export const getDashboardInsights = async (req, res) => {
//   try {
//     const organizationId = req.user.organizationId;

//     const topCustomer = await SalesInvoice.aggregate([
//       { $match: { organizationId } },
//       {
//         $group: {
//           _id: "$customerName",
//           total: { $sum: "$grandTotal" },
//         },
//       },
//       { $sort: { total: -1 } },
//       { $limit: 1 },
//     ]);

//     const highestSale = await SalesInvoice.findOne({ organizationId })
//       .sort({ grandTotal: -1 });

//     const pendingCount = await SalesInvoice.countDocuments({
//       organizationId,
//       outstandingAmount: { $gt: 0 },
//     });

//     res.json({
//       success: true,
//       data: {
//         topCustomer: topCustomer[0] || null,
//         highestSale: highestSale || null,
//         pendingInvoices: pendingCount,
//       },
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };