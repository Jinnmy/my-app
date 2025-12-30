Test Scenario | Settings Configuration | Test Case Description | User configures application preferences, AI features, Vault security, and System Reset
--- | --- | --- | ---
**Pre-condition** | User logged in. Navigate to "Settings" page. | **Post-condition** | Settings updated and saved locally or on server.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-Settings-Tray-001** | Toggle Minimize to Tray | 1. Locate "Application Defaults" > "Minimize to Tray"<br>2. Toggle switch ON/OFF | | Toggle state changes.<br>Setting persists after page refresh.<br>(If Electron) App minimizes to tray instead of quitting. | | | |
| **TC-Settings-AI-001** | Download AI Models | 1. Under "AI Features", check status "Models Not Found"<br>2. Click "Import AI Models"<br>3. Confirm large download warning | | Download progress bar appears.<br>Status changes to "Models Ready" upon completion.<br>"Import" button replaced by "Offload". | | | |
| **TC-Settings-AI-002** | Enable AI Features | 1. Ensure models are ready<br>2. Toggle "AI Processing" switch ON | | Toggle activates.<br>AI features (captioning/summarization) become available in valid file contexts. | | | |
| **TC-Settings-AI-003** | Offload AI Models | 1. Click "Offload Models"<br>2. Confirm warning | | Models deleted from disk.<br>Status reverts to "Models Not Found".<br>AI Toggle automatically disabled. | | | |
| **TC-Settings-Vault-001** | Change Vault Password | 1. Click "Change Password" in Vault Security section | | (Current Implementation): System alerts user that password change requires Disable/Re-enable cycle.<br>(Future/Ideal): Prompts for Old Pass -> New Pass -> Success. | | | |
| **TC-Settings-Vault-002** | Disable Vault | 1. Click "Disable Vault"<br>2. Enter Valid Vault Password<br>3. Confirm destructive warning | Password: [ValidPass] | Vault is disabled.<br>All encrypted data is wiped.<br>Status changes to "Not Configured". | | | |
| **TC-Settings-Reset-001** | Factory Reset (Admin Only) | 1. (As Admin) Locate "Danger Zone"<br>2. Click "Reset Application"<br>3. Confirm first warning<br>4. Enter Admin Password<br>5. Confirm final warning | Password: [AdminPass] | System initiates reset.<br>All users/files deleted.<br>App restarts to initial setup screen. | | | |
| **TC-Settings-Access-001** | Non-Admin Visibility | 1. Log in as Standard User<br>2. Navigate to Settings | | "Application Defaults", "AI Features", and "Danger Zone" are HIDDEN.<br>Only "Vault Security" is visible. | | | |
