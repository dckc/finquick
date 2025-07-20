# Contributing to makesheet

## Code Style

This project follows Airbnb JavaScript style guidelines. Use ESLint to check and fix code style:

```bash
yarn lint
yarn lint-fix
```

## Object Capability (OCap) Discipline

This project follows object-capability discipline to enable secure composition and testing. This means avoiding ambient authority where possible.

### Ambient Authority Pattern

When functions need to access global APIs (like `DriveApp.getFileById`), use dependency injection to allow callers to provide these capabilities:

```js
function doGet(e, io = {}) {
    const {
      getFileById = DriveApp.getFileById,
    } = io;
    // ... use getFileById instead of DriveApp.getFileById directly
}
```

This pattern provides several benefits:

1. **Testability**: Callers can inject mock implementations for testing
2. **Attenuation**: Callers can provide restricted versions of capabilities
3. **Composability**: Functions become more modular and reusable
4. **Security**: Reduces ambient authority and enables principle of least privilege

### References

For more details on object-capability discipline, see the [Agoric OCap Discipline wiki](https://github.com/Agoric/agoric-sdk/wiki/OCap-Discipline).

## Testing

Since this is Google Apps Script code, we use test functions that can be executed in the Google Apps Script debugger:

1. Create test functions prefixed with underscore (e.g., `_testDoGet`)
2. Use `console.log` to output test results
3. Run tests by selecting the test function in the GAS editor and clicking run
4. View results in the console output

This approach allows testing without external frameworks while maintaining the ability to test core functionality.