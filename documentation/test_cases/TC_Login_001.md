# Test Case: Login Scenarios

| Test Scenario ID | Login | Module | Authentication |
| :--- | :--- | :--- | :--- |
| **Description** | Verify user authentication behavior under various conditions (Valid, Invalid, Locked) | **Priority** | High |
| **Pre-conditions** | 1. Application is accessible.<br>2. Database is initialized with at least one active user (e.g., `admin`). | **Post-conditions** | User session state changes appropriate to the test result. |

<br>

## TC-Login-001: Valid Login
**Objective:** Verify that a user can log in with valid credentials.

| Test no. | Action | Input | Expected Output | Actual Output | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Navigate to Login Page | URL: `/login` | Login form is displayed. | | |
| 2 | Enter Credentials | Username: `admin`<br>Password: `validPass123` | Fields accept input. | | |
| 3 | Click "Login" | Click Button | System validates credentials.<br>User is redirected to Dashboard.<br>Session is created. | | |

<br>

## TC-Login-002: Invalid Username
**Objective:** Verify system behavior when a non-existent username is entered.

| Test no. | Action | Input | Expected Output | Actual Output | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Navigate to Login Page | URL: `/login` | Login form is displayed. | | |
| 2 | Enter Credentials | Username: `nonExistentUser`<br>Password: `anyPassword` | Fields accept input. | | |
| 3 | Click "Login" | Click Button | System displays error message:<br>**"Invalid username or password"**.<br>User remains on Login page. | | |

<br>

## TC-Login-003: Invalid Password
**Objective:** Verify system behavior when the wrong password is entered for a valid username.

| Test no. | Action | Input | Expected Output | Actual Output | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Navigate to Login Page | URL: `/login` | Login form is displayed. | | |
| 2 | Enter Credentials | Username: `admin`<br>Password: `wrongPassword!` | Fields accept input. | | |
| 3 | Click "Login" | Click Button | System displays error message:<br>**"Invalid username or password"**.<br>User remains on Login page. | | |

<br>

## TC-Login-004: Account Lockout
**Objective:** Verify that the account is locked after exceeding maximum login attempts.

| Test no. | Action | Input | Expected Output | Actual Output | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Navigate to Login Page | URL: `/login` | Login form is displayed. | | |
| 2 | Enter Invalid Credentials (Attempt 1) | Username: `admin`<br>Password: `wrong1` | Error: "Invalid username or password". | | |
| 3 | Enter Invalid Credentials (Attempt 2) | Username: `admin`<br>Password: `wrong2` | Error: "Invalid username or password". | | |
| 4 | Enter Invalid Credentials (Attempt 3) | Username: `admin`<br>Password: `wrong3` | Error: "Invalid username or password". | | |
| 5 | Enter Invalid Credentials (Attempt 4) | Username: `admin`<br>Password: `wrong4` | System displays lockout message:<br>**"Account locked. user exceeds max login attempts"** (or similar).<br>Further attempts are blocked for 15 mins. | | |

<br>

## TC-Login-005: Empty Fields
**Objective:** Verify that the system validation prevents submission of empty fields.

| Test no. | Action | Input | Expected Output | Actual Output | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Leave Username Empty | Username: `<empty>`<br>Password: `somePassword` | "Login" button disabled OR browser validation prompt "Please fill out this field". | | |
| 2 | Leave Password Empty | Username: `admin`<br>Password: `<empty>` | "Login" button disabled OR validation prompt. | | |
