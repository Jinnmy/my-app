# Login Workflow

This diagram illustrates the user login process.

```mermaid
flowchart TD
    Start([User Opens Login Page]) --> Input[Enter Username/Email & Password]
    Input --> Submit[Click 'Login']
    
    Submit --> API_Call[Send Credentials to Backend API]
    
    subgraph Authentication
        API_Call --> FetchUser[Find User in Database]
        FetchUser --> CheckExist{User Exists?}
        
        CheckExist -- No --> AuthFail[Return Error: Invalid Credentials]
        
        CheckExist -- Yes --> InitHash[Retrieve Stored Password Hash]
        InitHash --> Verify[Compare Password with Hash (Bcrypt/Argon2)]
        Verify --> Valid{Match?}
        
        Valid -- No --> AuthFail
        
        Valid -- Yes --> GenSession[Generate Session/JWT]
        GenSession --> ReturnSuccess[Return Success & Token]
    end
    
    AuthFail --> ShowError([Display Error Message])
    ReturnSuccess --> Redirect([Redirect to Dashboard])
```
