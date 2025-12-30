Test Scenario | Download File | Test Case Description | User downloads files from the system
--- | --- | --- | ---
**Pre-condition** | User logged in, file exists | **Post-condition** | File downloaded to local device

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Download-001 | Single File Download | 1. Right-click file -> "Download"<br>2. (Or double-click if configured) | | File downloads to browser's default download location.<br>File integrity verified (can be opened). | | | |
| TC-Download-002 | Locked File Download | 1. Right-click locked file -> "Download" | Password: `validPass` | Password prompt appears.<br>After valid password, download starts. | | | |
| TC-Download-003 | Locked File (Invalid Pass) | 1. Right-click locked file -> "Download" | Password: `wrong` | Password prompt appears.<br>Error: "Incorrect password".<br>Download does not start. | | | |
| TC-Download-004 | Folder Download | 1. Right-click folder | | "Download" option should be unavailable (hidden or disabled).<br>System does not support folder download (zip). | | | |
| TC-Download-005 | Encrypted File Download | 1. Right-click encrypted file (Vault) -> "Download" | (Vault Key present in session) | File downloads decrypted.<br>Content is readable. | | | |
