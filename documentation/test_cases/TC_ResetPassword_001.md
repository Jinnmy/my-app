Test Scenario | Reset Password | Test Case Description | User resets password using token
--- | --- | --- | ---
**Pre-condition** | Valid reset token generated and received | **Post-condition** | User password updated

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Reset-001 | Navigate with Valid Token | 1. Open email link with valid token<br>| URL: `/reset-password?token=valid_token` | Reset Password form displayed.<br>New Password fields enabled. | | | |
| TC-Reset-002 | Reset Successfully | 1. Enter new password<br><br>2. Confirm new password<br><br>3. Click "Reset Password" | New Pass: `NewPass123!`<br>Confirm: `NewPass123!` | System validates match and complexity.<br>Success message: "Password reset successful".<br>Redirect to Login. | | | |
| TC-Reset-003 | Mismatch Passwords | 1. Enter new password<br><br>2. Enter different confirm password<br><br>3. Click "Reset Password" | New Pass: `Pass123!`<br>Confirm: `Pass456!` | System displays error:<br>"Passwords do not match". | | | |
| TC-Reset-004 | Weak Password | 1. Enter weak password<br><br>2. Confirm weak password | New Pass: `123`<br>Confirm: `123` | System displays error:<br>"Password must be at least 8 chars...". | | | |
| TC-Reset-005 | Invalid/Expired Token | 1. Open email link with expired token | URL: `/reset-password?token=expired` | System displays error:<br>"Invalid or expired token".<br>Prompt to request new link. | | | |
