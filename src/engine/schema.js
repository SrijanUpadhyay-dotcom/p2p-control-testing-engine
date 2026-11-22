// Extract definitions: the six SAP-style files the engine accepts.
// Canonical field names follow SAP table fields where one exists.
// `aliases` are lower-cased, punctuation-free header names that map to the field.

export const EXTRACTS = [
  {
    id: 'vendors',
    name: 'Vendor master',
    source: 'LFA1 · LFB1 · J_1IMOVEND',
    template: 'vendors.csv',
    populationLabel: 'vendors',
    tested: false,
    key: ['LIFNR'],
    fields: [
      { f: 'LIFNR', label: 'Vendor code', type: 'text', required: true, aliases: ['vendor', 'vendorcode', 'vendorno', 'supplier', 'suppliercode'] },
      { f: 'NAME1', label: 'Vendor name', type: 'text', required: true, aliases: ['name', 'vendorname', 'suppliername'] },
      { f: 'PAN', label: 'PAN', type: 'text', required: false, aliases: ['panno', 'pannumber', 'j1ipanno'] },
      { f: 'GSTIN', label: 'GSTIN', type: 'text', required: false, aliases: ['gstno', 'gstnumber', 'stcd3'] },
      { f: 'MSME_CAT', label: 'MSME category (Micro/Small/Medium; blank = not MSME)', type: 'text', required: false, aliases: ['msme', 'msmecategory', 'udyamcategory', 'ssistatus', 'j1issist'] },
      { f: 'UDYAM_NO', label: 'Udyam registration no.', type: 'text', required: false, aliases: ['udyam', 'udyamno', 'udyamregistration'] },
      { f: 'ERDAT', label: 'Created on', type: 'date', required: false, aliases: ['createdon', 'creationdate'] }
    ]
  },
  {
    id: 'vendor_changes',
    name: 'Vendor master change log',
    source: 'S_ALR_87012089 · CDHDR/CDPOS · FK08',
    template: 'vendor_changes.csv',
    populationLabel: 'sensitive changes',
    tested: true,
    key: ['CHANGENR'],
    dateField: 'UDATE',
    fields: [
      { f: 'CHANGENR', label: 'Change document', type: 'text', required: true, aliases: ['changedoc', 'changedocument', 'changeno', 'changenumber'] },
      { f: 'UDATE', label: 'Change date', type: 'date', required: true, aliases: ['changedate', 'date', 'changedon'] },
      { f: 'LIFNR', label: 'Vendor code', type: 'text', required: true, aliases: ['vendor', 'vendorcode', 'supplier'] },
      { f: 'FIELD', label: 'Field changed (BANKN / BANKL+BANKN / ZTERM)', type: 'text', required: true, aliases: ['fieldchanged', 'fname', 'field'] },
      { f: 'USERNAME', label: 'Changed by', type: 'text', required: true, aliases: ['changedby', 'user', 'username'] },
      { f: 'CONF_USER', label: 'Confirmed by (FK08)', type: 'text', required: true, aliases: ['confirmedby', 'fk08user', 'confirmer'] },
      { f: 'CONF_DATE', label: 'Confirmation date', type: 'date', required: true, aliases: ['confirmationdate', 'confirmeddate', 'fk08date'] },
      { f: 'LETTER_ON_FILE', label: 'Vendor letter + bank proof on file (Y/N, bank changes)', type: 'flag', required: false, aliases: ['letteronfile', 'letter', 'bankproof'] },
      { f: 'CALLBACK_LOGGED', label: 'Call-back logged (Y/N, bank changes)', type: 'flag', required: false, aliases: ['callbacklogged', 'callback', 'callbackdone'] },
      { f: 'REQUEST_SOURCE', label: 'Request received from', type: 'text', required: false, aliases: ['requestsource', 'requestfrom', 'source'] }
    ]
  },
  {
    id: 'purchase_orders',
    name: 'Purchase orders',
    source: 'ME2N · EKKO/EKPO · release history',
    template: 'purchase_orders.csv',
    populationLabel: 'POs',
    tested: true,
    key: ['EBELN'],
    dateField: 'BEDAT',
    amountField: 'NETWR',
    fields: [
      { f: 'EBELN', label: 'PO number', type: 'text', required: true, aliases: ['pono', 'ponumber', 'purchaseorder', 'po'] },
      { f: 'BSART', label: 'PO type (NB standard, ZRC rate-contract call-off)', type: 'text', required: true, aliases: ['potype', 'doctype', 'documenttype'] },
      { f: 'BEDAT', label: 'PO date', type: 'date', required: true, aliases: ['podate', 'documentdate', 'createdon'] },
      { f: 'LIFNR', label: 'Vendor code', type: 'text', required: true, aliases: ['vendor', 'vendorcode', 'supplier'] },
      { f: 'MATKL', label: 'Material group', type: 'text', required: true, aliases: ['materialgroup', 'matgroup', 'category'] },
      { f: 'NETWR', label: 'PO value (final, ₹)', type: 'amount', required: true, aliases: ['povalue', 'netvalue', 'value', 'amount'] },
      { f: 'ERNAM', label: 'Created by', type: 'text', required: true, aliases: ['createdby', 'buyer'] },
      { f: 'REL_CODES', label: 'Release codes applied (e.g. PH;CFO)', type: 'text', required: true, aliases: ['releasecodes', 'releaselevels'] },
      { f: 'RELEASED_BY', label: 'Released by (users)', type: 'text', required: true, aliases: ['releasedby', 'approvers', 'approvedby'] },
      { f: 'REL_DATE', label: 'Final release date', type: 'date', required: true, aliases: ['releasedate', 'finalreleasedate', 'approvaldate'] },
      { f: 'FIRST_GR_DATE', label: 'First goods receipt date', type: 'date', required: false, aliases: ['firstgrdate', 'firstgrndate', 'grdate'] },
      { f: 'CHANGED_AFTER_REL', label: 'Value increased after release (Y/N)', type: 'flag', required: true, aliases: ['changedafterrelease', 'valuechanged'] },
      { f: 'RE_RELEASED', label: 'Re-released after change (Y/N)', type: 'flag', required: false, aliases: ['rereleased'] }
    ]
  },
  {
    id: 'invoices',
    name: 'Vendor invoices',
    source: 'MIRO · RBKP/RSEG',
    template: 'invoices.csv',
    populationLabel: 'invoices',
    tested: true,
    key: ['BELNR', 'GJAHR'],
    dateField: 'BUDAT',
    amountField: 'RMWWR',
    fields: [
      { f: 'BELNR', label: 'Invoice document', type: 'text', required: true, aliases: ['docno', 'documentno', 'mirodoc', 'invoicedoc'] },
      { f: 'GJAHR', label: 'Fiscal year', type: 'text', required: true, aliases: ['fiscalyear', 'year', 'fy'] },
      { f: 'LIFNR', label: 'Vendor code', type: 'text', required: true, aliases: ['vendor', 'vendorcode', 'supplier'] },
      { f: 'XBLNR', label: 'Vendor invoice number', type: 'text', required: true, aliases: ['invoiceno', 'invoicenumber', 'reference', 'vendorinvoiceno'] },
      { f: 'BLDAT', label: 'Invoice date', type: 'date', required: true, aliases: ['invdate', 'invoicedate', 'documentdate'] },
      { f: 'BUDAT', label: 'Posting date', type: 'date', required: true, aliases: ['postingdate', 'postdate'] },
      { f: 'ACCEPT_DATE', label: 'Date of acceptance (GRN / QI)', type: 'date', required: true, aliases: ['acceptdate', 'acceptancedate', 'grndate'] },
      { f: 'RMWWR', label: 'Gross amount (₹)', type: 'amount', required: true, aliases: ['grossamt', 'grossamount', 'amount', 'invoiceamount'] },
      { f: 'EBELN', label: 'PO reference', type: 'text', required: false, aliases: ['poref', 'pono', 'ponumber', 'purchaseorder'] },
      { f: 'USNAM', label: 'Posted by', type: 'text', required: true, aliases: ['postedby', 'user', 'enteredby'] }
    ]
  },
  {
    id: 'mrbr_releases',
    name: 'Blocked invoice releases',
    source: 'MRBR release log · RBKP_BLOCKED',
    template: 'mrbr_releases.csv',
    populationLabel: 'releases',
    tested: true,
    key: ['BELNR'],
    dateField: 'REL_DATE',
    amountField: 'VARIANCE',
    fields: [
      { f: 'BELNR', label: 'Invoice document', type: 'text', required: true, aliases: ['mirodoc', 'invoicedoc', 'docno'] },
      { f: 'XBLNR', label: 'Vendor invoice number', type: 'text', required: true, aliases: ['invoiceno', 'vendorinvoiceno'] },
      { f: 'BLDAT', label: 'Invoice date', type: 'date', required: true, aliases: ['invoicedate', 'invdate'] },
      { f: 'LIFNR', label: 'Vendor code', type: 'text', required: true, aliases: ['vendor', 'vendorcode'] },
      { f: 'EBELN', label: 'PO number', type: 'text', required: false, aliases: ['pono', 'po'] },
      { f: 'BLOCK_REASON', label: 'Block reason', type: 'text', required: true, aliases: ['blockreason', 'reason'] },
      { f: 'VARIANCE', label: 'Variance blocked (₹)', type: 'amount', required: true, aliases: ['variance', 'difference', 'blockedamount'] },
      { f: 'USNAM', label: 'Posted by', type: 'text', required: true, aliases: ['postedby'] },
      { f: 'REL_USER', label: 'Released by', type: 'text', required: true, aliases: ['releasedby', 'releaser'] },
      { f: 'REL_DATE', label: 'Release date', type: 'date', required: true, aliases: ['releasedate'] },
      { f: 'CONF_TYPE', label: 'Confirmation type', type: 'text', required: false, aliases: ['confirmationtype', 'support'] },
      { f: 'CONF_REF', label: 'Confirmation reference', type: 'text', required: false, aliases: ['confirmationref', 'reference'] },
      { f: 'CONF_DATE', label: 'Confirmation date', type: 'date', required: false, aliases: ['confirmationdate'] },
      { f: 'RELEASE_TEXT', label: 'Release text', type: 'text', required: false, aliases: ['releasetext', 'remarks', 'comment'] }
    ]
  },
  {
    id: 'payments',
    name: 'Payments',
    source: 'F110 · REGUH/REGUP · BSAK',
    template: 'payments.csv',
    populationLabel: 'payment lines',
    tested: true,
    key: ['VBLNR', 'BELNR'],
    dateField: 'LAUFD',
    amountField: 'RWBTR',
    fields: [
      { f: 'VBLNR', label: 'Payment document', type: 'text', required: true, aliases: ['paymentdoc', 'paymentdocument', 'clearingdoc'] },
      { f: 'LAUFD', label: 'Payment run date', type: 'date', required: true, aliases: ['rundate', 'paymentrundate'] },
      { f: 'VALUT', label: 'Value date', type: 'date', required: true, aliases: ['valuedate', 'paymentdate'] },
      { f: 'LIFNR', label: 'Vendor code', type: 'text', required: true, aliases: ['vendor', 'vendorcode'] },
      { f: 'BELNR', label: 'Invoice document paid', type: 'text', required: true, aliases: ['invoicedoc', 'mirodoc', 'docno'] },
      { f: 'RWBTR', label: 'Amount paid (₹)', type: 'amount', required: true, aliases: ['amount', 'amountpaid', 'paidamount'] }
    ]
  },
  {
    id: 'user_access',
    name: 'User access',
    source: 'SUIM · AGR_USERS · AGR_1251',
    template: 'user_access.csv',
    populationLabel: 'users',
    tested: true,
    key: ['BNAME', 'AGR_NAME'],
    fields: [
      { f: 'BNAME', label: 'User ID', type: 'text', required: true, aliases: ['user', 'userid', 'username'] },
      { f: 'USER_NAME', label: 'Name', type: 'text', required: false, aliases: ['name', 'fullname'] },
      { f: 'DEPARTMENT', label: 'Department', type: 'text', required: false, aliases: ['dept', 'function'] },
      { f: 'AGR_NAME', label: 'Role', type: 'text', required: true, aliases: ['role', 'rolename'] },
      { f: 'TCODES', label: 'Transaction codes in role (; separated)', type: 'text', required: true, aliases: ['tcodes', 'transactions', 'tcode'] }
    ]
  }
];

export const EXTRACT_BY_ID = Object.fromEntries(EXTRACTS.map((e) => [e.id, e]));

export const PERIOD_DEFAULT = { from: '2023-04-01', to: '2024-03-31' };
