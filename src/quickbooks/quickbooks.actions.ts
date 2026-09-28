export const action = {
  account: {
    create: 'createAccount',
    get: 'getAccount',
    getMany: 'getManyAccount',
    update: 'updateAccount',
  },

  customer: {
    create: 'createCustomer',
    get: 'getCustomer',
    getMany: 'getManyCustomer',
    update: 'updateCustomer',
  },
  invoice: {
    create: 'createInvoice',
    get: 'getInvoice',
    getMany: 'getManyInvoice',
    update: 'updateInvoice',
    delete: 'deleteInvoice',
    void: 'voidInvoice',
    send: 'sendInvoice',
    pdf: 'getInvoicePdf',
  },
  payment: {
    create: 'createPayment',
    delete: 'deletePayment',
    void: 'voidPayment',
    pdf: 'getPaymentPdf',
    getMany: 'getManyPayment',
    get: 'getPayment',
    send: 'sendPayment',
    update: 'updatePayment',
  },
  salesreceipt: {
    create: 'createSalesReceipt',
    delete: 'deleteSalesReceipt',
    void: 'voidSalesReceipt',
    pdf: 'getSalesReceiptPdf',
    getMany: 'getManySalesReceipt',
    get: 'getSalesReceipt',
    send: 'sendSalesReceipt',
    update: 'updateSalesReceipt',
    sparseUpdate: 'sparseUpdateSalesReceipt',
  },
  taxclassification: {
    get: 'getTaxClassification',
    getAll: 'getAllTaxClassifications',
    getByParentId: 'getTaxClassificationByParentId',
    getByLevel: 'getTaxClassificationsByLevel',
  },
  taxcode: {
    get: 'getTaxCode',
    getMany: 'getManyTaxCode',
  },
  taxpayment: {
    get: 'getTaxPayment',
    getMany: 'getManyTaxPayment',
  },
  taxrate: {
    get: 'getTaxRate',
    getMany: 'getManyTaxRate',
  },
  taxservice: {
    create: 'createTaxService',
  },
  taxsummary: {
    getMany: 'getManyTaxSummary',
  },
  taxagency: {
    create: 'createTaxAgency',
    get: 'getTaxAgency',
    getMany: 'getManyTaxAgency',
  },
  term: {
    create: 'createTerm',
    get: 'getTerm',
    getMany: 'getManyTerm',
    update: 'updateTerm',
  },
  timeactivity: {
    create: 'createTimeActivity',
    delete: 'deleteTimeActivity',
    getMany: 'getManyTimeActivity',
    get: 'getTimeActivity',
    update: 'updateTimeActivity',
  },
  transactionlist: {
    getMany: 'getManyTransactionList',
  },
  transactionlistbyvendor: {
    getMany: 'getManyTransactionListByVendor',
  },
  transactionlistbycustomer: {
    getMany: 'getManyTransactionListByCustomer',
  },
  transactionlistwithsplits: {
    getMany: 'getManyTransactionListWithSplits',
  },
  transfer: {
    create: 'createTransfer',
    delete: 'deleteTransfer',
    getMany: 'getManyTransfer',
    get: 'getTransfer',
    sparseUpdate: 'sparseUpdateTransfer',
    update: 'updateTransfer',
  },
  trialbalance: {
    getMany: 'getManyTrialBalance',
  },
  vendor: {
    create: 'createVendor',
    getMany: 'getManyVendor',
    get: 'getVendor',
    update: 'updateVendor',
  },
  vendorbalance: {
    getMany: 'getManyVendorBalance',
  },
  vendorbalancedetail: {
    getMany: 'getManyVendorBalanceDetail',
  },
  vendorcredit: {
    create: 'createVendorCredit',
    delete: 'deleteVendorCredit',
    getMany: 'getManyVendorCredit',
    get: 'getVendorCredit',
    update: 'updateVendorCredit',
  },
 vendorExpenses: {
  getMany: 'getManyVendorExpenses',
},
accountlistdetail: {
  getMany: 'getManyAccountListDetail',
},
apagingdetail: {
  getMany: 'getManyAPAgingDetail',
},
apagingSummary: {
  getMany: 'getManyAPAgingSummary',
},
aragingdetail: {
getMany: 'getManyARAgingDetail',
},
aragingSummary: {
  getMany: 'getManyARAgingSummary',
},
attachable: {
  create: 'createAttachable',
  delete: 'deleteAttachable',
  getMany: 'getManyAttachable',
  get: 'getAttachable',
  update: 'updateAttachable',
  download: 'downloadAttachable',
  upload: 'uploadAttachable',
},
balancesheet: {
  getMany: 'getBalanceSheet',
},
batch: {
  create: 'createBatch',
},
bill: {
  create: 'createBill',
  delete: 'deleteBill',
  getMany: 'getManyBill',
  get: 'getBill',
  update: 'updateBill',
},
billpayment: {
  create: 'createBillPayment',
  void: 'voidBillPayment',
  delete: 'deleteBillPayment',
  getMany: 'getManyBillPayment',
  get: 'getBillPayment',
  update: 'updateBillPayment',
},
budget: {
  create: 'createBudget',
  delete: 'deleteBudget',
  getMany: 'getManyBudget',
  get: 'getBudget',
  update: 'updateBudget',
},
};
