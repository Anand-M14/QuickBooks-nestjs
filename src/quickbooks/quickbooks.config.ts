import { action } from './quickbooks.actions.js';

export const modules = [
  {
    module: 'account',
    actions: ['create', 'get', 'getMany', 'update'],
    triggers: [],
  },

  {
    module: 'customer',
    actions: ['create', 'get', 'getMany', 'update'],
    triggers: [],
  },

  {
    module: 'invoice',
    actions: [
      'create',
      'get',
      'getMany',
      'update',
      'delete',
      'void',
      'send',
      'pdf',
    ],
    triggers: [],
  },

  {
    module: 'payment',
    actions: [
      'create',
      'delete',
      'void',
      'pdf',
      'getMany',
      'get',
      'send',
      'update',
    ],
    triggers: [],
  },
  {
    module: 'salesreceipt',
    actions: [
      'create',
      'delete',
      'void',
      'pdf',
      'getMany',
      'get',
      'send',
      'update',
      'sparseUpdate',
    ],
    triggers: [],
  },
  {
    module: 'taxclassification',
    actions: ['get', 'getAll', 'getByParentId', 'getByLevel'],
    triggers: [],
  },
  {
    module: 'taxcode',
    actions: ['getMany', 'get'],
    triggers: [],
  },
  {
    module: 'taxpayment',
    actions: ['getMany', 'get'],
    triggers: [],
  },
  {
    module: 'taxrate',
    actions: ['getMany', 'get'],
    triggers: [],
  },
  {
    module: 'taxservice',
    actions: ['create'],
    triggers: [],
  },
  {
    module: 'taxsummary',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'taxagency',
    actions: ['create', 'get', 'getMany'],
    triggers: [],
  },
  {
    module: 'term',
    actions: ['create', 'get', 'getMany', 'update'],
    triggers: [],
  },
  {
    module: 'timeactivity',
    actions: ['create', 'get', 'getMany', 'update', 'delete'],
    triggers: [],
  },
  {
    module: 'transactionlist',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'transactionlistbyvendor',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'transactionlistbycustomer',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'transactionlistwithsplits',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'transfer',
    actions: ['create', 'delete', 'getMany', 'get', 'update', 'sparseUpdate'],
    triggers: [],
  },
  {
    module: 'trialbalance',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'vendor',
    actions: ['create', 'get', 'getMany', 'update'],
    triggers: [],
  },
  {
    module: 'vendorbalance',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'vendorbalancedetail',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'vendorcredit',
    actions: ['create', 'delete', 'getMany', 'get', 'update'],
    triggers: [],
  },
  {
    module: 'vendorExpenses',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'accountlistdetail',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'apagingdetail',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'apagingSummary',
    actions: ['getMany'],
    triggers: [],
  },
   {
    module: 'aragingdetail',
    actions: ['getMany'],
    triggers: [],
  },
   {
    module: 'aragingSummary',
    actions: ['getMany'],
    triggers: [],
  },
  {
    module: 'attachable',
    actions: ['create', 'delete', 'getMany', 'get', 'update','download','upload'],
    triggers: [],
  },
     {
    module: 'balancesheet',
    actions: ['getMany'],
    triggers: [],
  },
       {
    module: 'batch',
    actions: ['create'],
    triggers: [],
  },
    {
    module: 'bill',
    actions: ['create', 'delete', 'getMany', 'get', 'update'],
    triggers: [],
  },
      {
    module: 'billpayment',
    actions: ['create', 'delete', 'getMany', 'get', 'update','void'],
    triggers: [],
  },
      {
    module: 'budget',
    actions: ['create', 'delete', 'getMany', 'get', 'update'],
    triggers: [],
  },
];
