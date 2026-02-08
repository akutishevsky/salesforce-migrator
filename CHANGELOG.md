# Change Log

## [1.2.0] 2026-02-08

### Added

-   Added multi-select metadata retrieval and deployment with checkboxes in the deployment panel and a new "Selected Metadata" sidebar view for batch operations
-   Added folder-based metadata support for EmailTemplate, Report, Dashboard, and Document types with inline expandable tree navigation

### Fixed

-   Fixed progress notification blocking by moving result messages outside withProgress
-   Fixed table border rendering in metadata deployment panel

## [1.1.0] 2026-01-17

### Added

-   Added query copier functionality to copy SOQL queries to clipboard from the query editor

### Fixed

-   Updated package versions and added overrides for js-yaml, glob, and brace-expansion to address security vulnerabilities

## [1.0.3] 2025-07-05

### Fixed

-   Fixed export operation returning fewer records than expected compared to SOQL queries in Developer Console
-   Enhanced Bulk API 2.0 query result retrieval with proper pagination handling using query locators
-   Added record count validation by comparing Bulk API results with direct SOQL query counts
-   Improved progress reporting with detailed job statistics and record processing information
-   Fixed API version inconsistencies between REST and Bulk API calls
-   Added automatic retry option when record count mismatches are detected

### Enhanced

-   Added comprehensive export validation with pre and post-operation record count verification
-   Enhanced error handling and user notifications for missing records scenarios
-   Improved CSV result concatenation for paginated query results
-   Added detailed logging for troubleshooting export operations

## [1.0.2] 2025-04-12

-   Fixed "ClientInputError: LineEnding is invalid on user data" error when uploading large record sets on Windows.

## [1.0.1] 2025-04-12

### Fixed

-   Fixed an issue when the orgs without aliases were displayed as Undefined.
-   Fixed an issue when the spinner was still spinning after clicking at metadata type while the target org is not selected.

## [1.0.0] 2025-04-10

-   Initial release
