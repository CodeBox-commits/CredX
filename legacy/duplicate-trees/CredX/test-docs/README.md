# Test Documents

This folder contains ready-to-upload borrower packs for the CredX document ingestion flow.

## Included packs

### `nebula_stressed_case`
Use this to trigger higher-risk signals like:
- GSTR-2A vs GSTR-3B mismatch
- Circular trading / revenue inflation cue
- Negative cash flow / working capital stress
- Related-party exposure
- Litigation / NCLT risk

### `sunline_stable_case`
Use this to test a cleaner borrower profile with:
- Better collections
- Positive cash flow
- Strong order book
- Mild GST variance

## Best way to test

1. Open `Document Analyzer`.
2. Upload all PDFs from one case folder together.
3. Compare how the risk signals, research insights, and recommendation change between the two packs.

## Note

Text versions are included for quick reading. PDF versions are included so the backend parser and browser fallback can both be tested more realistically.
