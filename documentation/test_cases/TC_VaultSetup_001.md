Test Scenario | Vault Setup | Test Case Description | User sets up the secure vault for the first time or resets it
--- | --- | --- | ---
**Pre-condition** | User logged in. | **Post-condition** | Vault password set, Vault enabled.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Vault-Setup-001 | Successful Initial Setup | 1. Navigate to "Vault" section<br>2. Prompted to "Create Vault Password"<br>3. Enter valid password and confirm<br>4. Click "Create" | Password: "SecurePass123!"<br>Confirm: "SecurePass123!" | Vault created successfully.<br>Success notification displayed.<br>User automatically logged into Vault or prompted to login. | | | |
| TC-Vault-Setup-002 | Password Mismatch | 1. Navigate to "Vault" (First time)<br>2. Enter password<br>3. Enter DIFFERENT confirmation password<br>4. Click "Create" | Password: "PassA"<br>Confirm: "PassB" | Error message displayed: "Passwords do not match".<br>Vault NOT created. | | | |
| TC-Vault-Setup-003 | Weak Password Validation | 1. Navigate to "Vault" (First time)<br>2. Enter weak password<br>3. Click "Create" | Password: "123"<br>Confirm: "123" | Error message displayed: "Password too weak" (if complexity is enforced).<br>Vault NOT created. | | | |
| TC-Vault-Setup-004 | Vault Reset (Already Exists) | 1. Navigate to "Vault"<br>2. Select "Reset Vault" option (if available via settings or specific flow)<br>3. Confirm warning "All data will be wiped" | | Existing vault data deleted.<br>System prompts for new password setup.<br>Success notification after new setup. | | | |
| TC-Vault-Setup-005 | Cancel Setup | 1. Navigate to "Vault"<br>2. Click "Cancel" or "Close" on setup modal | | Modal closes.<br>User redirected to previous screen (e.g. Dashboard).<br>Vault NOT created. | | | |
