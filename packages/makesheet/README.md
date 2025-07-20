# makesheet

Google Sheets timestamp service for Make-based workflows.

## Overview

This package provides a Google Apps Script web app that returns the modification timestamp of a Google Sheet. This is useful for Make-based build systems that need to track when a sheet has been modified to trigger downstream processing.

## Setup

1. Install clasp globally if you haven't already:
   ```bash
   npm install -g @google/clasp
   ```

2. Login to Google Apps Script:
   ```bash
   yarn login
   ```

3. Create a new Google Apps Script project and note the script ID.

4. Update `.clasp.json` with your script ID:
   ```json
   {
     "scriptId": "your-script-id-here",
     "rootDir": "."
   }
   ```

5. Push the code to Google Apps Script:
   ```bash
   yarn push
   ```

6. Deploy as a web app and note the deployment ID:
   ```bash
   yarn deploy
   ```

## Usage

Once deployed, you can query the modification time of a Google Sheet using:

```bash
curl -s "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?sheetId=YOUR_SHEET_ID"
```

This returns a JSON response:
```json
{
  "modifiedTime": "2023-12-01T15:30:45.123Z"
}
```

Or an error response:
```json
{
  "error": "sheetId parameter required"
}
```

## Integration with Make

Use the provided `example-usage.mk` file as a reference for integrating with Make-based workflows.

## Scripts

- `yarn push` - Push code to Google Apps Script
- `yarn deploy` - Push and deploy as web app (requires DEPLOYMENT_ID env var)
- `yarn curl` - Test the deployed web app (requires DEPLOYMENT_ID and SHEET_ID env vars)
- `yarn login` - Login to Google Apps Script
- `yarn lint` - Run ESLint to check code style (Airbnb style)
- `yarn lint-fix` - Run ESLint and automatically fix issues

## Testing

The code includes test functions that can be used with the Google Apps Script debugger:

- `_testDoGet()` - Tests the main `doGet` function with various input scenarios
- `_testCreateJsonResponse()` - Tests the JSON response creation function

To run tests in the Google Apps Script editor:
1. Open your script in the Google Apps Script editor
2. Select one of the test functions from the function dropdown
3. Click the run button to execute the test
4. View the output in the console

This approach follows the pattern suggested for testing Google Apps Script functions without requiring external test frameworks.