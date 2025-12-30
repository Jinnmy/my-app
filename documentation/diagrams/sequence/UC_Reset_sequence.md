```mermaid
sequenceDiagram
    actor User
    participant System
    participant Database

    %% Forgot Password Flow
    User->>System: Request Password Reset (Email)
    System->>Database: Check if Email Exists
    alt User Found
        Database-->>System: User Details
        System-->>User: Send Password Reset Email
    else User Not Found
        Database-->>System: No Record
        System-->>User: Show Generic Message / Error
    end

    %% Reset Password Flow
    User->>System: Submit New Password (Validation Token)
    System->>Database: Verify Token
    alt Token Valid
        Database-->>System: Token OK
        System->>Database: Update Password & Clear Token
        Database-->>System: Success
        System-->>User: Notify Success (Login Prompt)
    else Token Invalid
        Database-->>System: Invalid/Expired
        System-->>User: Show Error Message
    end
```
