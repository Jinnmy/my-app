# Vault File Operations

This diagram illustrates securing files in the vault and accessing them.

```mermaid
flowchart TD
    Start([User Selects File]) --> Action{Action?}
    
    %% Move to Vault
    Action -- Move to Vault --> Lock[Request Lock/Encrypt]
    Lock --> CheckVault{Vault Enabled?}
    
    CheckVault -- No --> Error([Error: Setup Vault First])
    CheckVault -- Yes --> EncryptProcess
    
    subgraph Encryption
        EncryptProcess[Generate Encryption Key] --> EncryptFile[Encrypt File Content]
        EncryptFile --> MarkDB[Set is_encrypted = 1]
        MarkDB --> DeleteOrig[Secure Delete Original]
    end
    
    DeleteOrig --> Done([File Locked])

    %% Access Vault
    Action -- Open Vault --> Prompt[Prompt for Vault Password]
    Prompt --> Verify[Verify Hash]
    
    Verify -- Fail --> Deny([Access Denied])
    Verify -- Success --> Token[Issue Unlock Token (Session)]
    
    Token --> List[List Vault Files (Decrypt Names)]
    List --> ViewFile[User Clicks File]
    
    ViewFile --> DecryptRequest[Request Stream + Token]
    DecryptRequest --> DecryptStream[On-the-fly Decryption]
    DecryptStream --> Display([Show Content])
```
