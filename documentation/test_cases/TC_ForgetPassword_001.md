Test Scenario | Forget Password | Test Case Description | User requests password reset via email
--- | --- | --- | ---
**Pre-condition** | System setup with email service configured | **Post-condition** | Reset token generated and email sent (if valid)

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Forgot-001 | Navigate to Forgot Password | 1. Navigate to Login Page<br><br>2. Click "Forgot Password?" link | Click Link | User redirected to `/forgot-password` page.<br>Email input field displayed. | | | |
| TC-Forgot-002 | Valid Email Request | 1. Enter valid registered email<br><br>2. Click "Send Reset Link" | Email: `user@example.com` | System displays success message: "If an account exists, a reset link has been sent."<br>Email received with reset link. | | | |
| TC-Forgot-003 | Unregistered Email | 1. Enter unregistered email<br><br>2. Click "Send Reset Link" | Email: `stranger@example.com` | System displays generic success message.<br>No email is sent (OR email sent stating account doesn't exist - depending on policy). | | | |
| TC-Forgot-004 | Invalid Email Format | 1. Enter invalid email format<br><br>2. Click "Send Reset Link" | Email: `user.com` (no @) | System displays validation error:<br>"Please enter a valid email address". | | | |
| TC-Forgot-005 | Empty Email | 1. Leave Email Empty<br><br>2. Click "Send Reset Link" | Email: `<empty>` | "Send" button disabled OR validation prompt "Please fill out this field". | | | |
