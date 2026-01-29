# Cross-System Integration

How ertp-ledgerguise integrates with external systems via GnuCash's standard fields.

## Account Codes

GnuCash accounts have a `code` field designed for cross-system integration. Use it to maintain stable identifiers across systems.

### Setting Account Codes

```js
// Using sealed token (POLA: no withdrawal authority leaked)
chart.placePurse({
  sealedPurse: sealer.seal(purse),
  name: 'Checking',
  parentGuid: bankGuid,
  accountType: 'BANK',
  code: '1110',  // Stable identifier for external systems
});

// Or using GUID directly (if you already know the account GUID)
chart.placeAccount({
  accountGuid,
  name: 'Checking',
  parentGuid: bankGuid,
  accountType: 'BANK',
  code: '1110',
});
```

### Typical Numbering Conventions

| Range | Category |
|-------|----------|
| 1000-1999 | Assets |
| 2000-2999 | Liabilities |
| 3000-3999 | Equity |
| 4000-4999 | Income |
| 5000-5999 | Cost of Goods Sold |
| 6000-6999 | Expenses |

Within a category, use hierarchical numbering:
- `1000` Assets (placeholder)
- `1100` Bank (placeholder)
- `1110` Checking
- `1120` Savings

### Querying by Code

```sql
SELECT * FROM accounts WHERE code = '1110';
```

## Transaction Numbers (Check Numbers)

The `transactions.num` field stores check numbers or other reference numbers for cross-system reconciliation.

### Use Cases

- Check numbers from bank statements
- Invoice numbers from billing systems
- Reference IDs from payment processors
- Correlation IDs for distributed transactions

### Setting Transaction Numbers

Transaction numbers are set during `withdraw()` operations via the `nowMs` clock, which generates sequential identifiers. Custom reference numbers can be set by querying and updating the transaction after creation.

## GUIDs

GnuCash uses 32-character hex GUIDs as primary keys. These are:
- Globally unique
- Stable across exports/imports
- Suitable for distributed systems

### GUID Generation

The `makeGuid` capability injected into `createIssuerKit` controls GUID generation:

```js
// Deterministic (for testing)
import { mockMakeGuid } from './guids.js';
const makeGuid = mockMakeGuid();

// Random (for production)
import { makeDeterministicGuid } from './guids.js';
const makeGuid = makeDeterministicGuid();
```

## Integration Patterns

### 1. Bank Reconciliation

Use account codes to map GnuCash accounts to bank accounts, then reconcile by matching:
- Transaction dates (`post_date`)
- Amounts (`value_num / value_denom`)
- Reference numbers (`num`)

### 2. External Ledger Sync

Export transactions with:
- Account codes (not GUIDs) for portability
- ISO dates from `post_date`
- Rational amounts (`value_num / value_denom`)

### 3. Audit Trail

The `enter_date` field records when a transaction was created (vs `post_date` which is the effective date). Use this for audit trails and debugging.

### 4. Multi-System Escrow

For escrow spanning multiple systems:
1. Create escrow accounts with agreed-upon codes
2. Use transaction `num` fields for correlation IDs
3. Query by code to verify state across systems

## See Also

- `test/snapshots/design-doc.test.ts.md` - Shows account codes in the hierarchy test
- GnuCash documentation on account codes
