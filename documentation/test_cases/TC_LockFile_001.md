Test Scenario | Lock/Unlock File | Test Case Description | User secures files with password protection
--- | --- | --- | ---
**Pre-condition** | User logged in, file exists, user is owner | **Post-condition** | File locked status updated

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Lock-001 | Lock File | 1. Right-click file -> "Lock"<br>2. Enter password<br>3. Confirm password<br>4. Click "Lock" | Password: `Secret123` | File icon changes to locked state.<br>Success notification.<br>Actions (Open/Edit) now require password. | | | |
| TC-Lock-002 | Unlock File (Valid) | 1. Right-click locked file -> "Unlock"<br>2. Enter correct password<br>3. Click "Unlock" | Password: `Secret123` | File unlocked successfully.<br>Lock icon removed.<br>File accessible without password. | | | |
| TC-Lock-003 | Unlock File (Invalid) | 1. Right-click locked file -> "Unlock"<br>2. Enter incorrect password | Password: `WrongPass` | Unlock failed.<br>Error: "Incorrect password".<br>File remains locked. | | | |
| TC-Lock-004 | Access Locked File | 1. Double-click locked file (or "Preview") | | System prompts for password.<br>Content not displayed until verified. | | | |
| TC-Lock-005 | Verify Operation Block | 1. Try to Delete/Rename/Move locked file | | Action blocked (or prompts for password first).<br>Error: "File is locked". | | | |
