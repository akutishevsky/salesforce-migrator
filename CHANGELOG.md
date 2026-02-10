# Change Log

## [1.2.1] 2026-02-10

### Security

- Replaced `exec()` with `cross-spawn` to prevent command injection
- Added Content Security Policy to all webview HTML pages
- Replaced `unsafe-inline` with hash-based CSP in loading page
- Replaced `innerHTML` with DOM APIs across webviews to prevent XSS (folder list, DML mapping table, records export)
- Escaped user-controlled values in webview HTML (org identifiers, metadata names, object names, field labels, error messages)
- Added input validation for webview message fields across all handlers
- Added format validation for object names, field names, org aliases, and metadata names
- Validated HTTPS scheme for Salesforce instance URLs in API classes
- Validated `jobId` format and URL-encoded `queryLocator` in Bulk API calls
- Validated SOQL query `FROM` clause matches expected object
- Validated `deployUrl` scheme before opening external URLs
- Added path traversal checks on export destination, DML output, custom object file save, and `defaultPath`
- Added operation allowlist to `createDmlJob`
- Sanitized CSV cell values to prevent formula injection
- Sanitized error messages to avoid exposing internal details
- Removed `console.log` of Bulk API response body
- Added sensitive file patterns to `.gitignore`
- Replaced ReDoS-vulnerable regex in `queryRecordCount`

### Fixed

- Added 60-second timeout to all individual `fetch()` calls
- Added 30-minute timeout to job polling loops
- Added 150 MB file size limit on CSV upload
- Added 100 MB buffer size limit to CLI output accumulation
- Added pagination guard to `getQueryJobResults`
- Used array chunks for query result accumulation to reduce memory pressure
- Validated date/datetime/numeric values in WHERE clause builder
- Added HTTP 401 detection with re-authentication guidance
- Silently ignore unknown commands in OrgSelectorView

### Refactored

- Marked class members as `readonly` where appropriate across all services and views
- Preferred `node:crypto` over `crypto` for Node.js built-in imports
- Preferred `.dataset` over `getAttribute('data-…')` / `hasAttribute` / `setAttribute`
- Preferred `String#replaceAll()` over `String#replace()` with `/g` flag
- Used `new Error()` instead of `Error()`
- Used `localeCompare` for reliable alphabetical sorting
- Used parameterless `catch` instead of void operator
- Renamed catch parameters to `error_` convention
- Replaced single-case `switch` with `if` statement
- Removed nested template literals
- General code smell fixes across extension entry point, services, views, and webviews

## [1.2.0] 2026-02-08

### Added

- Added multi-select metadata retrieval and deployment with checkboxes in the deployment panel and a new "Selected Metadata" sidebar view for batch operations
- Added folder-based metadata support for EmailTemplate, Report, Dashboard, and Document types with inline expandable tree navigation

### Fixed

- Fixed progress notification blocking by moving result messages outside withProgress
- Fixed table border rendering in metadata deployment panel

## [1.1.0] 2026-01-17

### Added

- Added query copier functionality to copy SOQL queries to clipboard from the query editor

### Fixed

- Updated package versions and added overrides for js-yaml, glob, and brace-expansion to address security vulnerabilities

## [1.0.3] 2025-07-05

### Fixed

- Fixed export operation returning fewer records than expected compared to SOQL queries in Developer Console
- Enhanced Bulk API 2.0 query result retrieval with proper pagination handling using query locators
- Added record count validation by comparing Bulk API results with direct SOQL query counts
- Improved progress reporting with detailed job statistics and record processing information
- Fixed API version inconsistencies between REST and Bulk API calls
- Added automatic retry option when record count mismatches are detected

### Enhanced

- Added comprehensive export validation with pre and post-operation record count verification
- Enhanced error handling and user notifications for missing records scenarios
- Improved CSV result concatenation for paginated query results
- Added detailed logging for troubleshooting export operations

## [1.0.2] 2025-04-12

- Fixed "ClientInputError: LineEnding is invalid on user data" error when uploading large record sets on Windows.

## [1.0.1] 2025-04-12

### Fixed

- Fixed an issue when the orgs without aliases were displayed as Undefined.
- Fixed an issue when the spinner was still spinning after clicking at metadata type while the target org is not selected.

## [1.0.0] 2025-04-10

- Initial release
