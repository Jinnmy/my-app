Test Scenario | Vault Operations | Test Case Description | User performs daily operations within the Vault (Unlock, Lock, File Management)
--- | --- | --- | ---
**Pre-condition** | Vault is set up (password exists). User is logged in. | **Post-condition** | Vault state changes (Locked/Unlocked) or File state changes (Encrypted/Decrypted/Deleted).

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-Vault-Unlock-001** | Successful Unlock | 1. Navigate to "Vault" tab<br>2. Enter correct Vault password<br>3. Click "Unlock" | Password: [CorrectPass] | Vault unlocks.<br>Encrypted files list is displayed.<br>"Unlock" session timer starts. | | | |
| **TC-Vault-Unlock-002** | Incorrect Password | 1. Navigate to "Vault" tab<br>2. Enter INCORRECT password<br>3. Click "Unlock" | Password: [WrongPass] | Error message: "Incorrect Password".<br>Vault remains locked.<br>Files are NOT visible. | | | |
| **TC-Vault-Unlock-003** | Max Attempts Lockout | 1. Attempt to unlock with wrong password multiple times (e.g. 5 times) | Password: [WrongPass] x 5 | System enforces temporary lockout (e.g. "Try again in 5 minutes").<br>Unlock button disabled. | | | |
| **TC-Vault-Lock-001** | Manual Lock | 1. While Vault is unlocked<br>2. Click "Lock Vault" button (usually in toolbar or corner) | | Vault locks immediately.<br>Files are hidden.<br>User returned to Locked Placeholder screen. | | | |
| **TC-Vault-Lock-002** | Auto-Lock Timeout | 1. Unlock Vault<br>2. Leave system idle for X minutes (default 15m or as configured) | | Vault automatically locks.<br>Subsequent access requires password re-entry. | | | |
| **TC-Vault-Upload-001** | Upload Directly to Vault | 1. Unlock Vault<br>2. Click "Upload" button inside Vault view<br>3. Select file | File: "secret_doc.pdf" | File uploads and is automatically encrypted.<br>File appears in Vault list with encrypted icon/status. | | | |
| **TC-Vault-Move-001** | Move File to Vault | 1. In standard file list, select a file<br>2. Context Menu -> "Move to Vault"<br>3. Enter Vault Password (if not already unlocked) | File: "financials.csv" | File removed from public/standard storage.<br>File appears in Vault.<br>File is encrypted. | | | |
| **TC-Vault-Download-001** | Download/View File | 1. Inside Vault<br>2. Double click file OR Right-click -> Download | File: "secret_doc.pdf" | System requests temporary decryption.<br>File downloads to local machine OR opens in secure viewer.<br>Content is legible. | | | |
| **TC-Vault-Delete-001** | Delete File from Vault | 1. Inside Vault<br>2. Select file -> Click "Delete"<br>3. Confirm warning | | File is permanently deleted.<br>Verify file is NOT in standard "Recently Deleted" (Vault usually bypasses Trash for security). | | | |
| **TC-Vault-Session-001** | Session Persistence | 1. Unlock Vault<br>2. Navigate to "Dashboard"<br>3. Navigate back to "Vault" (within timeout period) | | Vault remains unlocked (no password prompt required). | | | |
